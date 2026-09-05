import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import type { Priority, Recurrence, Status, Task } from "../types";
import { useStore, useToasts } from "../store";
import { Field, Modal, ModalHeader, inputCls, selectCls } from "./ui";
import { PRIORITY_META, STATUS_META } from "../lib/engine";
import { fmtMinutes } from "../lib/dates";

interface Props {
  open: boolean;
  onClose: () => void;
  taskId?: string | null;
  defaults?: Partial<Task>;
}

const EST_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240];

export default function TaskModal({ open, onClose, taskId, defaults }: Props) {
  const { state, projects, addTask, patchTask } = useStore();
  const { push } = useToasts();
  const editing = useMemo(() => state.tasks.find((t) => t.id === taskId) ?? null, [state.tasks, taskId]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [project, setProject] = useState("General");
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<Status>("todo");
  const [dueDate, setDueDate] = useState<string>("");
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [tags, setTags] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("none");
  const [dependsOn, setDependsOn] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const src = editing ?? defaults ?? {};
    setTitle(src.title ?? "");
    setDescription(src.description ?? "");
    setProject(src.project ?? "General");
    setPriority(src.priority ?? "medium");
    setStatus(src.status ?? "todo");
    setDueDate(src.dueDate ?? "");
    setEstimatedMinutes(src.estimatedMinutes ?? 30);
    setTags((src.tags ?? []).join(", "));
    setRecurrence(src.recurrence ?? "none");
    setDependsOn(src.dependsOn ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId]);

  const candidates = state.tasks.filter((t) => t.id !== taskId && t.status !== "done");

  const submit = () => {
    if (!title.trim()) {
      push("warn", "Title is required", "Give the task a short, concrete name.");
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim(),
      project: project.trim() || "General",
      priority,
      status,
      dueDate: dueDate || null,
      estimatedMinutes: Math.max(5, estimatedMinutes || 30),
      tags: tags.split(",").map((t) => t.trim().replace(/^#/, "").toLowerCase()).filter(Boolean),
      recurrence,
      dependsOn,
    };
    if (editing) {
      patchTask(editing.id, payload);
      push("success", "Task updated", `“${payload.title}”`);
    } else {
      addTask(payload);
      push("success", "Task created", `“${payload.title}” added to ${payload.project}`);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} width="max-w-2xl">
      <ModalHeader kicker={editing ? "Edit task" : "New task"} title={editing ? "Update the details" : "Capture the work"} onClose={onClose} />
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
        <div className="grid gap-4">
          <Field label="Title">
            <input
              autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) submit(); }}
              placeholder="e.g. Send Q3 invoice to Meridian" className={inputCls}
            />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="What does “done” look like?" className={`${inputCls} resize-none`} />
          </Field>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Project">
              <input list="tempo-projects" value={project} onChange={(e) => setProject(e.target.value)} className={inputCls} />
              <datalist id="tempo-projects">
                {projects.map((p) => <option key={p} value={p} />)}
              </datalist>
            </Field>
            <Field label="Priority">
              <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className={`${selectCls} w-full py-2`}>
                {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_META[p].label}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={`${selectCls} w-full py-2`}>
                {(Object.keys(STATUS_META) as Status[]).map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Estimate (minutes)">
              <input type="number" min={5} step={5} value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(parseInt(e.target.value || "0", 10))} className={inputCls} />
            </Field>
            <Field label="Recurrence">
              <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} className={`${selectCls} w-full py-2`}>
                <option value="none">One-off</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </Field>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {EST_PRESETS.map((m) => (
              <button key={m} type="button" onClick={() => setEstimatedMinutes(m)}
                className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-all
                  ${estimatedMinutes === m ? "border-pine bg-pinemist text-pinedeep font-semibold" : "border-line bg-paper text-inksoft hover:border-pine/50"}`}>
                {fmtMinutes(m)}
              </button>
            ))}
          </div>

          <Field label="Tags (comma separated)">
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="invoice, meridian, routine" className={inputCls} />
          </Field>

          {candidates.length > 0 && (
            <Field label="Depends on (can't start until these are done)">
              <div className="max-h-36 overflow-y-auto rounded-lg border border-line bg-paper p-2">
                {candidates.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] transition-colors hover:bg-mist">
                    <input type="checkbox" checked={dependsOn.includes(t.id)}
                      onChange={(e) => setDependsOn((d) => e.target.checked ? [...d, t.id] : d.filter((x) => x !== t.id))}
                      className="accent-[#1e6b57]" />
                    <span className="flex-1 truncate text-ink">{t.title}</span>
                    <span className="font-mono text-[10.5px] text-inkfaint">{STATUS_META[t.status].label}</span>
                  </label>
                ))}
              </div>
            </Field>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-linesoft px-5 py-3.5">
        <button onClick={onClose} className="rounded-lg px-3.5 py-2 text-[13px] font-medium text-inksoft transition-colors hover:bg-mist">
          Cancel
        </button>
        <button onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-pinedeep hover:shadow-md active:scale-[0.98]">
          <Save size={14} /> {editing ? "Save changes" : "Create task"}
        </button>
      </div>
    </Modal>
  );
}
