import { useMemo, useState } from "react";
import { Clock3, Lock, Plus, Repeat, Users } from "lucide-react";
import type { Status, Task } from "../types";
import { useStore, useToasts } from "../store";
import { STATUS_META, STATUS_ORDER, scoreTask, byIdMap, blockedBy, projectChip } from "../lib/engine";
import { dueLabel, fmtMinutes } from "../lib/dates";
import { ScoreMeter, TagChip } from "./ui";

interface Props {
  onOpenTask: (id: string) => void;
  onNewTask: (status: Status) => void;
}

export default function Board({ onOpenTask, onNewTask }: Props) {
  const { state, setStatus } = useStore();
  const { push } = useToasts();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Status | null>(null);

  const byId = byIdMap(state.tasks);
  const cols = useMemo(() => {
    const map: Record<Status, (Task & { score: number })[]> = { todo: [], inprogress: [], waiting: [], blocked: [], done: [] };
    for (const t of state.tasks) {
      map[t.status].push({ ...t, score: scoreTask(t, state.tasks).score });
    }
    for (const s of STATUS_ORDER) map[s].sort((a, b) => b.score - a.score);
    map.done = map.done
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
      .slice(0, 8);
    return map;
  }, [state.tasks]);

  const wip = cols.inprogress.length;

  const drop = (status: Status) => {
    if (!dragId) return;
    const t = state.tasks.find((x) => x.id === dragId);
    setDragId(null); setOverCol(null);
    if (!t || t.status === status) return;
    setStatus(t.id, status);
    if (status === "done") push("success", "Task completed", `“${t.title}” moved to Done`);
    else push("info", `Moved to ${STATUS_META[status].label}`, t.title);
  };

  return (
    <div className="flex h-full gap-3 overflow-x-auto pb-3">
      {STATUS_ORDER.map((s) => {
        const meta = STATUS_META[s];
        const items = cols[s];
        const isOver = overCol === s;
        return (
          <div
            key={s}
            onDragOver={(e) => { e.preventDefault(); setOverCol(s); }}
            onDragLeave={() => setOverCol((c) => (c === s ? null : c))}
            onDrop={() => drop(s)}
            className={`flex h-full min-h-0 w-[268px] shrink-0 flex-col rounded-xl border transition-all duration-200 sm:w-[280px]
              ${isOver ? "border-pine bg-pinemist/50 shadow-lg shadow-pine/10" : "border-line bg-paper/70"}`}
          >
            <header className="flex items-center gap-2 px-3.5 pb-2 pt-3.5">
              <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              <h3 className="font-display text-[12.5px] font-semibold uppercase tracking-[0.08em] text-inksoft">{meta.label}</h3>
              <span className="rounded-full bg-linesoft px-1.5 py-px font-mono text-[10.5px] font-medium text-inksoft">{items.length}</span>
              {s === "inprogress" && wip > 4 && (
                <span className="rounded-md bg-tangmist px-1.5 py-px font-mono text-[10px] font-semibold text-tang" title="A lot in flight — consider finishing before starting more">
                  WIP high
                </span>
              )}
              {s !== "done" && (
                <button onClick={() => onNewTask(s)}
                  className="ml-auto rounded-md p-1 text-inkfaint transition-colors hover:bg-mist hover:text-pine" aria-label={`Add task to ${meta.label}`}>
                  <Plus size={13} />
                </button>
              )}
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 pb-2.5">
              {items.map((t, i) => (
                <BoardCard key={t.id} t={t} onOpen={onOpenTask}
                  dragging={dragId === t.id}
                  onDragStart={() => setDragId(t.id)}
                  onDragEnd={() => { setDragId(null); setOverCol(null); }}
                  delay={i * 30} />
              ))}
              {items.length === 0 && (
                <div className={`rounded-lg border border-dashed px-3 py-6 text-center font-mono text-[10.5px] transition-colors ${isOver ? "border-pine text-pine" : "border-line text-inkfaint"}`}>
                  {isOver ? "Release to drop" : s === "done" ? "Nothing finished yet" : "Drop tasks here"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BoardCard({ t, onOpen, onDragStart, onDragEnd, dragging, delay }: {
  t: Task & { score: number };
  onOpen: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  dragging: boolean;
  delay: number;
}) {
  const { state } = useStore();
  const byId = byIdMap(state.tasks);
  const blocked = blockedBy(t, byId).length > 0;
  const due = dueLabel(t.dueDate);
  const stripe =
    t.priority === "critical" ? "bg-ember" : t.priority === "high" ? "bg-tang" : t.priority === "medium" ? "bg-steel" : "bg-sage";

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(); }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(t.id)}
      className={`anim-rise group relative cursor-grab overflow-hidden rounded-lg border bg-card p-3 transition-all duration-200 active:cursor-grabbing
        ${dragging ? "rotate-2 scale-95 opacity-50" : "hover:-translate-y-0.5 hover:border-line hover:shadow-md hover:shadow-ink/8"}
        ${t.status === "done" ? "border-linesoft opacity-75" : "border-line"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className={`absolute inset-y-0 left-0 w-[3px] ${stripe}`} />
      <div className="pl-1.5">
        <p className={`text-[13px] font-medium leading-snug ${t.status === "done" ? "text-inkfaint line-through" : "text-ink"}`}>{t.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[10.5px] font-medium ${projectChip(t.project)}`}>{t.project}</span>
          {t.status !== "done" && (
            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium
              ${due.tone === "over" ? "bg-embermist text-ember" : due.tone === "today" ? "bg-ambrmist text-amber" : "bg-linesoft text-inksoft"}`}>
              {due.text}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 font-mono text-[10px] text-inkfaint">
            <Clock3 size={9} /> {fmtMinutes(t.estimatedMinutes)}
          </span>
          {blocked && <span title="Blocked by unfinished dependencies"><Lock size={10} className="text-rust" /></span>}
          {t.status === "waiting" && <Users size={10} className="text-amber" />}
          {t.recurrence !== "none" && <Repeat size={10} className="text-pine" />}
        </div>
        <div className="mt-2 flex items-center justify-between">
          {t.status !== "done" ? <ScoreMeter score={t.score} /> : (
            <span className="font-mono text-[10px] text-doneg">
              {t.actualMinutes != null ? `took ${fmtMinutes(t.actualMinutes)}` : "done"}
            </span>
          )}
          <span className="flex gap-1">
            {t.tags.slice(0, 2).map((tag) => <TagChip key={tag} tag={tag} />)}
          </span>
        </div>
        {t.subtasks.length > 0 && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-linesoft">
            <div className="h-full rounded-full bg-pine transition-all duration-500"
              style={{ width: `${(t.subtasks.filter((s) => s.done).length / t.subtasks.length) * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
