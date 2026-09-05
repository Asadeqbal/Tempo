import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2, Copy, Flag, Link as LinkIcon, Lock, Pencil, Play,
  Plus, Repeat, RotateCcw, Sparkles, Trash2, X, ExternalLink, History,
} from "lucide-react";
import type { Task } from "../types";
import { useStore, useToasts } from "../store";
import {
  DueChip, PriorityBadge, ProgressBar, ProjectChip, ScoreMeter, SectionHead, StatusBadge, TagChip, inputCls,
} from "./ui";
import {
  PRIORITY_META, STATUS_META, blockedBy, decomposeSuggestions, dependentsOf, byIdMap, scoreTask,
} from "../lib/engine";
import { fmtDate, fmtDateTime, fmtMinutes, relativeFrom, todayISO } from "../lib/dates";

interface Props {
  taskId: string | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onPlan: (id: string) => void;
}

const KIND_DOT: Record<string, string> = {
  created: "bg-steel", status: "bg-pine", priority: "bg-tang", edit: "bg-sage",
  note: "bg-amber", completed: "bg-doneg", reopened: "bg-tang", duplicated: "bg-steel",
  recurrence: "bg-pine", subtask: "bg-pine", planned: "bg-amber", decomposed: "bg-pine",
};

export default function TaskDrawer({ taskId, onClose, onEdit, onPlan }: Props) {
  const store = useStore();
  const { push } = useToasts();
  const task = useMemo(() => store.state.tasks.find((t) => t.id === taskId) ?? null, [store.state.tasks, taskId]);

  const [completing, setCompleting] = useState(false);
  const [actualMin, setActualMin] = useState(30);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [subDraft, setSubDraft] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [decomposeOpen, setDecomposeOpen] = useState(false);
  const [pickedSuggestions, setPickedSuggestions] = useState<string[]>([]);
  const [depPick, setDepPick] = useState("");

  useEffect(() => {
    setCompleting(false); setConfirmDelete(false); setNoteDraft(""); setSubDraft("");
    setLinkLabel(""); setLinkUrl(""); setDecomposeOpen(false); setDepPick("");
    if (task) { setActualMin(task.estimatedMinutes); setPickedSuggestions(decomposeSuggestions(task)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [taskId, onClose]);

  if (!task) return null;

  const byId = byIdMap(store.state.tasks);
  const { score } = scoreTask(task, store.state.tasks);
  const deps = blockedBy(task, byId);
  const dependents = dependentsOf(task.id, store.state.tasks);
  const timeline = store.state.activity.filter((a) => a.taskId === task.id).slice(0, 30);
  const doneSubs = task.subtasks.filter((s) => s.done).length;
  const isPlannedToday = task.plannedFor === todayISO();
  const candidates = store.state.tasks.filter((t) => t.id !== task.id && t.status !== "done" && !task.dependsOn.includes(t.id));

  const doComplete = () => {
    store.completeTask(task.id, actualMin);
    setCompleting(false);
    push("success", "Task completed", `Logged ${fmtMinutes(actualMin)} of work${task.recurrence !== "none" ? " — next occurrence scheduled" : ""}`);
    onClose();
  };

  const doDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); window.setTimeout(() => setConfirmDelete(false), 2600); return; }
    store.deleteTask(task.id);
    push("info", "Task deleted", `“${task.title}” was removed`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="anim-fade absolute inset-0 bg-night/35" onClick={onClose} />
      <aside className="anim-drawer absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col border-l border-line bg-card shadow-2xl">
        {/* Header */}
        <div className="border-b border-linesoft px-6 py-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <ProjectChip name={task.project} />
              <PriorityBadge p={task.priority} />
              <StatusBadge s={task.status} />
              <DueChip due={task.dueDate} done={task.status === "done"} />
              {task.recurrence !== "none" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-pinemist px-1.5 py-0.5 text-[11px] font-medium text-pine">
                  <Repeat size={10} /> {task.recurrence}
                </span>
              )}
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-inkfaint transition-colors hover:bg-mist hover:text-ink" aria-label="Close panel">
              <X size={16} />
            </button>
          </div>
          <h2 className={`font-display text-xl font-semibold leading-snug text-ink ${task.status === "done" ? "line-through decoration-2 decoration-doneg/60 text-inksoft" : ""}`}>
            {task.title}
          </h2>
          {task.description && <p className="mt-1.5 text-[13px] leading-relaxed text-inksoft">{task.description}</p>}
          <div className="mt-3 flex items-center gap-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-inkfaint">Priority score</span>
            <ScoreMeter score={score} />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-linesoft bg-paper/70 px-6 py-3">
          {task.status !== "done" ? (
            <>
              {task.status !== "inprogress" && (
                <button onClick={() => { store.setStatus(task.id, "inprogress"); push("info", "Task started", "Timer of life begins — status set to In Progress"); }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-pinedeep active:scale-[0.97]">
                  <Play size={12} /> Start
                </button>
              )}
              {completing ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-doneg/40 bg-donemist px-2 py-1">
                  <span className="font-mono text-[11px] text-doneg">actual</span>
                  <input type="number" min={1} value={actualMin} onChange={(e) => setActualMin(parseInt(e.target.value || "0", 10))}
                    className="w-14 rounded border border-line bg-card px-1.5 py-0.5 font-mono text-xs outline-none focus:border-pine" />
                  <span className="font-mono text-[11px] text-doneg">min</span>
                  <button onClick={doComplete} className="rounded bg-doneg px-2 py-0.5 text-[11px] font-bold text-white hover:brightness-110">Done</button>
                </span>
              ) : (
                <button onClick={() => { setActualMin(task.estimatedMinutes); setCompleting(true); }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-doneg/40 bg-donemist px-3 py-1.5 text-xs font-semibold text-doneg transition-all hover:bg-doneg hover:text-white active:scale-[0.97]">
                  <CalendarCheck2 size={12} /> Complete
                </button>
              )}
              <button onClick={() => onPlan(task.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all active:scale-[0.97]
                  ${isPlannedToday ? "border-amber/40 bg-ambrmist text-amber" : "border-line bg-card text-inksoft hover:border-amber/50 hover:text-amber"}`}>
                <CalendarCheck2 size={12} /> {isPlannedToday ? "Planned today" : "Plan today"}
              </button>
            </>
          ) : (
            <button onClick={() => { store.reopenTask(task.id); push("info", "Task reopened"); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold text-inksoft transition-all hover:border-pine hover:text-pine active:scale-[0.97]">
              <RotateCcw size={12} /> Reopen
            </button>
          )}
          <span className="mx-1 h-4 w-px bg-line" />
          <button onClick={() => onEdit(task.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-inksoft transition-colors hover:bg-mist hover:text-ink">
            <Pencil size={12} /> Edit
          </button>
          <button onClick={() => { const c = store.duplicateTask(task.id); if (c) push("success", "Task duplicated", `“${c.title}” created`); }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-inksoft transition-colors hover:bg-mist hover:text-ink">
            <Copy size={12} /> Duplicate
          </button>
          <button onClick={doDelete}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all active:scale-[0.97]
              ${confirmDelete ? "bg-ember text-white" : "text-inksoft hover:bg-embermist hover:text-ember"}`}>
            <Trash2 size={12} /> {confirmDelete ? "Click to confirm" : "Delete"}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Meta */}
          <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Meta label="Due date" value={task.dueDate ? fmtDate(task.dueDate) : "—"} />
            <Meta label="Estimate" value={fmtMinutes(task.estimatedMinutes)} />
            <Meta label="Actual" value={task.actualMinutes != null ? fmtMinutes(task.actualMinutes) : "—"} />
            <Meta label="Created" value={fmtDateTime(task.createdAt)} />
            <Meta label="Last updated" value={relativeFrom(task.updatedAt)} />
            <Meta label="Started" value={task.inProgressSince ? relativeFrom(task.inProgressSince) : task.completedAt ? fmtDateTime(task.completedAt) : "—"} />
          </div>

          {task.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-1.5">
              {task.tags.map((t) => <TagChip key={t} tag={t} />)}
            </div>
          )}

          {/* Dependencies */}
          <section className="mb-6">
            <SectionHead title="Dependencies" count={task.dependsOn.length + dependents.length} />
            {deps.length > 0 && (
              <div className="mb-2 rounded-lg border border-rust/30 bg-rustmist/60 p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-rust"><Lock size={11} /> Blocked until these finish</p>
                {deps.map((d) => <DepRow key={d.id} t={d} />)}
              </div>
            )}
            {dependents.length > 0 && (
              <div className="mb-2 rounded-lg border border-line bg-paper p-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold text-inksoft"><Flag size={11} /> Finishing this unblocks</p>
                {dependents.map((d) => <DepRow key={d.id} t={d} />)}
              </div>
            )}
            {candidates.length > 0 && (
              <div className="flex gap-1.5">
                <select value={depPick} onChange={(e) => setDepPick(e.target.value)}
                  className="flex-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-xs text-ink outline-none focus:border-pine">
                  <option value="">Add a dependency…</option>
                  {candidates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <button disabled={!depPick}
                  onClick={() => { store.patchTask(task.id, { dependsOn: [...task.dependsOn, depPick] }); setDepPick(""); }}
                  className="rounded-lg border border-line px-2.5 text-xs font-medium text-inksoft transition-colors hover:border-pine hover:text-pine disabled:opacity-40">
                  <Plus size={13} />
                </button>
              </div>
            )}
            {task.dependsOn.length === 0 && dependents.length === 0 && (
              <p className="text-xs text-inkfaint">No dependencies — this task stands alone.</p>
            )}
          </section>

          {/* Subtasks */}
          <section className="mb-6">
            <SectionHead
              title="Subtasks"
              count={task.subtasks.length}
              right={
                <button onClick={() => { setPickedSuggestions(decomposeSuggestions(task)); setDecomposeOpen(true); }}
                  className="inline-flex items-center gap-1 rounded-md bg-pinemist px-2 py-1 text-[11px] font-semibold text-pinedeep transition-all hover:bg-pine hover:text-white active:scale-95">
                  <Sparkles size={11} /> Suggest breakdown
                </button>
              }
            />
            {task.subtasks.length > 0 && (
              <div className="mb-2">
                <ProgressBar value={task.subtasks.length ? doneSubs / task.subtasks.length : 0} />
                <p className="mt-1 font-mono text-[10.5px] text-inkfaint">{doneSubs}/{task.subtasks.length} complete</p>
              </div>
            )}
            <ul className="space-y-1">
              {task.subtasks.map((s) => (
                <li key={s.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-mist">
                  <input type="checkbox" checked={s.done} onChange={() => store.toggleSubtask(task.id, s.id)} className="accent-[#1e6b57]" />
                  <span className={`flex-1 text-[13px] ${s.done ? "text-inkfaint line-through" : "text-ink"}`}>{s.title}</span>
                  <button onClick={() => store.removeSubtask(task.id, s.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100 text-inkfaint hover:text-ember" aria-label="Remove subtask">
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-1.5">
              <input value={subDraft} onChange={(e) => setSubDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && subDraft.trim()) { store.addSubtasks(task.id, [subDraft.trim()]); setSubDraft(""); } }}
                placeholder="Add a subtask and press Enter" className={inputCls} />
              <button onClick={() => { if (subDraft.trim()) { store.addSubtasks(task.id, [subDraft.trim()]); setSubDraft(""); } }}
                className="rounded-lg border border-line px-3 text-inksoft transition-colors hover:border-pine hover:text-pine" aria-label="Add subtask">
                <Plus size={14} />
              </button>
            </div>

            {decomposeOpen && (
              <div className="anim-pop mt-3 rounded-xl border border-pine/25 bg-pinemist/50 p-3.5">
                <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-pinedeep">
                  <Sparkles size={12} /> Suggested breakdown — pick the steps that fit
                </p>
                <div className="space-y-1">
                  {decomposeSuggestions(task).map((sug) => (
                    <label key={sug} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] text-ink transition-colors hover:bg-card/70">
                      <input type="checkbox" checked={pickedSuggestions.includes(sug)}
                        onChange={(e) => setPickedSuggestions((p) => e.target.checked ? [...p, sug] : p.filter((x) => x !== sug))}
                        className="accent-[#1e6b57]" />
                      {sug}
                    </label>
                  ))}
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button disabled={!pickedSuggestions.length}
                    onClick={() => { store.addSubtasks(task.id, pickedSuggestions); setDecomposeOpen(false); push("success", "Task decomposed", `${pickedSuggestions.length} subtasks added`); }}
                    className="rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-pinedeep disabled:opacity-40">
                    Add {pickedSuggestions.length} subtask{pickedSuggestions.length !== 1 && "s"}
                  </button>
                  <button onClick={() => setDecomposeOpen(false)} className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-inksoft hover:bg-card/70">
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Notes */}
          <section className="mb-6">
            <SectionHead title="Notes" />
            {task.notes && (
              <p className="mb-2 whitespace-pre-wrap rounded-lg border border-line bg-paper p-3 text-[12.5px] leading-relaxed text-inksoft">{task.notes}</p>
            )}
            <div className="flex gap-1.5">
              <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && noteDraft.trim()) { store.addNote(task.id, noteDraft.trim()); setNoteDraft(""); } }}
                placeholder="Jot a note and press Enter" className={inputCls} />
              <button onClick={() => { if (noteDraft.trim()) { store.addNote(task.id, noteDraft.trim()); setNoteDraft(""); } }}
                className="rounded-lg border border-line px-3 text-xs font-medium text-inksoft transition-colors hover:border-pine hover:text-pine">
                Add
              </button>
            </div>
          </section>

          {/* Links */}
          <section className="mb-6">
            <SectionHead title="Links & attachments" count={task.links.length} />
            {task.links.length > 0 && (
              <ul className="mb-2 space-y-1">
                {task.links.map((l) => (
                  <li key={l.id} className="group flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-mist">
                    <LinkIcon size={12} className="shrink-0 text-inkfaint" />
                    <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-[12.5px] text-steel underline-offset-2 hover:underline">
                      {l.label} <ExternalLink size={10} className="inline" />
                    </a>
                    <button onClick={() => store.removeLink(task.id, l.id)} className="opacity-0 transition-opacity group-hover:opacity-100 text-inkfaint hover:text-ember" aria-label="Remove link">
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-1.5">
              <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label" className={`${inputCls} w-2/5`} />
              <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className={inputCls} />
              <button onClick={() => {
                if (linkLabel.trim() && linkUrl.trim()) {
                  store.addLink(task.id, linkLabel.trim(), linkUrl.trim().startsWith("http") ? linkUrl.trim() : `https://${linkUrl.trim()}`);
                  setLinkLabel(""); setLinkUrl("");
                }
              }} className="rounded-lg border border-line px-3 text-inksoft transition-colors hover:border-pine hover:text-pine" aria-label="Add link">
                <Plus size={14} />
              </button>
            </div>
          </section>

          {/* Timeline */}
          <section className="pb-4">
            <SectionHead title="Activity timeline" count={timeline.length} right={<History size={13} className="text-inkfaint" />} />
            <ol className="relative ml-1.5 space-y-3 border-l border-line pl-4">
              {timeline.map((a) => (
                <li key={a.id} className="relative">
                  <span className={`absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-card ${KIND_DOT[a.kind] ?? "bg-sage"}`} />
                  <p className="text-[12.5px] leading-snug text-ink">{a.text}</p>
                  <p className="font-mono text-[10.5px] text-inkfaint">{fmtDateTime(a.at)}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint">{label}</p>
      <p className="mt-0.5 text-[12.5px] font-medium text-ink">{value}</p>
    </div>
  );
}

function DepRow({ t }: { t: Task }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-card/80 px-2 py-1.5">
      <StatusBadge s={t.status} />
      <span className="flex-1 truncate text-[12.5px] text-ink">{t.title}</span>
      <span className="font-mono text-[10.5px] text-inkfaint">{PRIORITY_META[t.priority].label}</span>
    </div>
  );
}
