import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import { CheckCircle2, Info, AlertTriangle } from "lucide-react";
import type { ActivityEvent, ActivityKind, AppState, Settings, Status, Task } from "./types";
import { fmtMinutes, nextOccurrence, todayISO, fmtDate } from "./lib/dates";
import { PRIORITY_META, STATUS_META } from "./lib/engine";

export function uid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Brand-new workspace for a freshly created profile. */
export function buildFreshState(name: string): AppState {
  const now = new Date().toISOString();
  const welcome: Task = {
    id: uid(),
    title: "Welcome to Tempo — make it yours",
    description:
      "Capture tasks fast with ⌘K (try: “Send invoice !high due friday 15m”). Open the dashboard to see what the engine thinks you should do next, press F for Focus Mode, and use “Plan My Day” to fit work into your available hours.",
    project: "Getting started",
    priority: "low",
    status: "todo",
    dueDate: null,
    estimatedMinutes: 5,
    actualMinutes: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    inProgressSince: null,
    tags: ["onboarding"],
    notes: "",
    links: [],
    dependsOn: [],
    recurrence: "none",
    subtasks: [
      { id: uid(), title: "Capture your first real task with ⌘K", done: false },
      { id: uid(), title: "Try Plan My Day on the dashboard", done: false },
      { id: uid(), title: "Press F and finish one task in Focus Mode", done: false },
    ],
    plannedFor: null,
  };
  return {
    tasks: [welcome],
    activity: [{ id: uid(), taskId: welcome.id, at: now, kind: "created", text: "Workspace created" }],
    settings: { workdayHours: 8, userName: name },
    seededAt: now,
  };
}

/* --------------------------------- Store --------------------------------- */

export type NewTaskInput = Partial<Omit<Task, "id">> & { title: string };

interface StoreValue {
  state: AppState;
  projects: string[];
  addTask: (input: NewTaskInput) => Task;
  patchTask: (id: string, patch: Partial<Task>) => void;
  setStatus: (id: string, status: Status) => void;
  completeTask: (id: string, actualMinutes?: number) => void;
  reopenTask: (id: string) => void;
  deleteTask: (id: string) => void;
  duplicateTask: (id: string) => Task | null;
  addNote: (id: string, text: string) => void;
  addLink: (id: string, label: string, url: string) => void;
  removeLink: (id: string, linkId: string) => void;
  addSubtasks: (id: string, titles: string[]) => void;
  toggleSubtask: (id: string, subId: string) => void;
  removeSubtask: (id: string, subId: string) => void;
  setPlannedFor: (id: string, date: string | null) => void;
  setSettings: (patch: Partial<Settings>) => void;
  resetAll: () => void;
  exportJSON: () => void;
}

const StoreCtx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(StoreCtx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}

function mkEvent(taskId: string, kind: ActivityKind, text: string): ActivityEvent {
  return { id: uid(), taskId, at: new Date().toISOString(), kind, text };
}

export function StoreProvider({
  children,
  initial,
  onPersist,
}: {
  children: ReactNode;
  initial: AppState;
  onPersist?: (state: AppState) => void;
}) {
  const [state, setState] = useState<AppState>(initial);
  const ref = useRef(state);
  ref.current = state;
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return; // initial state already came from the encrypted vault
    }
    onPersist?.(state);
  }, [state, onPersist]);

  const commit = useCallback((fn: (s: AppState) => AppState) => {
    const next = fn(ref.current);
    ref.current = next;
    setState(next);
  }, []);

  const withTask = (s: AppState, id: string, fn: (t: Task) => Task, events: ActivityEvent[] = []): AppState => ({
    ...s,
    tasks: s.tasks.map((t) => (t.id === id ? { ...fn(t), updatedAt: new Date().toISOString() } : t)),
    activity: [...events, ...s.activity],
  });

  const value = useMemo<StoreValue>(() => {
    const addTask: StoreValue["addTask"] = (input) => {
      const now = new Date().toISOString();
      const task: Task = {
        id: uid(),
        title: input.title,
        description: input.description ?? "",
        project: input.project ?? "General",
        priority: input.priority ?? "medium",
        status: input.status ?? "todo",
        dueDate: input.dueDate ?? null,
        estimatedMinutes: input.estimatedMinutes ?? 30,
        actualMinutes: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
        inProgressSince: null,
        tags: input.tags ?? [],
        notes: input.notes ?? "",
        links: input.links ?? [],
        dependsOn: input.dependsOn ?? [],
        recurrence: input.recurrence ?? "none",
        subtasks: input.subtasks ?? [],
        plannedFor: input.plannedFor ?? null,
      };
      commit((s) => ({
        ...s,
        tasks: [task, ...s.tasks],
        activity: [mkEvent(task.id, "created", `Task created in ${task.project}`), ...s.activity],
      }));
      return task;
    };

    const patchTask: StoreValue["patchTask"] = (id, patch) => {
      commit((s) => {
        const prev = s.tasks.find((t) => t.id === id);
        if (!prev) return s;
        const events: ActivityEvent[] = [];
        const next = { ...prev, ...patch };
        if (patch.status && patch.status !== prev.status) {
          events.push(mkEvent(id, "status", `Status → ${STATUS_META[patch.status].label}`));
          if (patch.status === "inprogress" && !patch.inProgressSince) next.inProgressSince = new Date().toISOString();
          if (patch.status !== "inprogress") next.inProgressSince = null;
          if (patch.status === "done") {
            next.completedAt = new Date().toISOString();
            next.actualMinutes = next.actualMinutes ?? next.estimatedMinutes;
            events.push(mkEvent(id, "completed", `Completed in ${fmtMinutes(next.actualMinutes)} (est ${fmtMinutes(next.estimatedMinutes)})`));
          }
        }
        if (patch.priority && patch.priority !== prev.priority)
          events.push(mkEvent(id, "priority", `Priority → ${PRIORITY_META[patch.priority].label}`));
        if ("dueDate" in patch && patch.dueDate !== prev.dueDate)
          events.push(mkEvent(id, "edit", patch.dueDate ? `Due date → ${fmtDate(patch.dueDate)}` : "Due date cleared"));
        if (patch.project && patch.project !== prev.project)
          events.push(mkEvent(id, "edit", `Moved to project “${patch.project}”`));
        if (patch.estimatedMinutes != null && patch.estimatedMinutes !== prev.estimatedMinutes)
          events.push(mkEvent(id, "edit", `Estimate → ${fmtMinutes(patch.estimatedMinutes)}`));
        if (patch.recurrence != null && patch.recurrence !== prev.recurrence)
          events.push(mkEvent(id, "edit", `Recurrence → ${patch.recurrence}`));
        if (!events.length) events.push(mkEvent(id, "edit", "Details updated"));
        return withTask(s, id, () => next, events);
      });
    };

    const setStatus: StoreValue["setStatus"] = (id, status) => {
      commit((s) => {
        const prev = s.tasks.find((t) => t.id === id);
        if (!prev || prev.status === status) return s;
        return withTaskRecurrence(s, id, status);
      });
    };

    const completeTask: StoreValue["completeTask"] = (id, actualMinutes) => {
      commit((s) => withTaskRecurrence(s, id, "done", actualMinutes));
    };

    const reopenTask: StoreValue["reopenTask"] = (id) => {
      commit((s) =>
        withTask(s, id, (t) => ({ ...t, status: "todo", completedAt: null, actualMinutes: null }),
          [mkEvent(id, "reopened", "Task reopened")])
      );
    };

    const deleteTask: StoreValue["deleteTask"] = (id) => {
      commit((s) => ({
        ...s,
        tasks: s.tasks.filter((t) => t.id !== id).map((t) =>
          t.dependsOn.includes(id) ? { ...t, dependsOn: t.dependsOn.filter((d) => d !== id) } : t
        ),
        activity: s.activity.filter((a) => a.taskId !== id),
      }));
    };

    const duplicateTask: StoreValue["duplicateTask"] = (id) => {
      const prev = ref.current.tasks.find((t) => t.id === id);
      if (!prev) return null;
      const now = new Date().toISOString();
      const copy: Task = {
        ...prev,
        id: uid(),
        title: `${prev.title} (copy)`,
        status: "todo",
        completedAt: null,
        actualMinutes: null,
        inProgressSince: null,
        plannedFor: null,
        createdAt: now,
        updatedAt: now,
        subtasks: prev.subtasks.map((st) => ({ ...st, id: uid(), done: false })),
      };
      commit((s) => ({
        ...s,
        tasks: [copy, ...s.tasks],
        activity: [mkEvent(copy.id, "duplicated", `Duplicated from “${prev.title}”`), ...s.activity],
      }));
      return copy;
    };

    const addNote: StoreValue["addNote"] = (id, text) => {
      commit((s) =>
        withTask(s, id, (t) => ({ ...t, notes: t.notes ? `${t.notes}\n${text}` : text }),
          [mkEvent(id, "note", text.length > 90 ? text.slice(0, 90) + "…" : text)])
      );
    };

    const addLink: StoreValue["addLink"] = (id, label, url) => {
      commit((s) =>
        withTask(s, id, (t) => ({ ...t, links: [...t.links, { id: uid(), label, url }] }),
          [mkEvent(id, "edit", `Link added: ${label}`)])
      );
    };

    const removeLink: StoreValue["removeLink"] = (id, linkId) => {
      commit((s) => withTask(s, id, (t) => ({ ...t, links: t.links.filter((l) => l.id !== linkId) })));
    };

    const addSubtasks: StoreValue["addSubtasks"] = (id, titles) => {
      commit((s) =>
        withTask(s, id, (t) => ({
          ...t,
          subtasks: [...t.subtasks, ...titles.map((title) => ({ id: uid(), title, done: false }))],
        }), [mkEvent(id, titles.length > 1 ? "decomposed" : "subtask",
          titles.length > 1 ? `Decomposed into ${titles.length} subtasks` : `Subtask added: ${titles[0]}`)])
      );
    };

    const toggleSubtask: StoreValue["toggleSubtask"] = (id, subId) => {
      commit((s) => {
        const t = s.tasks.find((x) => x.id === id);
        const st = t?.subtasks.find((x) => x.id === subId);
        return withTask(s, id, (task) => ({
          ...task,
          subtasks: task.subtasks.map((x) => (x.id === subId ? { ...x, done: !x.done } : x)),
        }), st ? [mkEvent(id, "subtask", `${st.done ? "Subtask reopened" : "Subtask done"}: ${st.title}`)] : []);
      });
    };

    const removeSubtask: StoreValue["removeSubtask"] = (id, subId) => {
      commit((s) => withTask(s, id, (t) => ({ ...t, subtasks: t.subtasks.filter((x) => x.id !== subId) })));
    };

    const setPlannedFor: StoreValue["setPlannedFor"] = (id, date) => {
      commit((s) =>
        withTask(s, id, (t) => ({ ...t, plannedFor: date }),
          [mkEvent(id, "planned", date ? `Planned for ${fmtDate(date)}` : "Removed from day plan")])
      );
    };

    const setSettings: StoreValue["setSettings"] = (patch) => {
      commit((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    };

    const resetAll: StoreValue["resetAll"] = () => {
      const fresh = buildFreshState(ref.current.settings.userName);
      commit(() => fresh);
    };

    const exportJSON: StoreValue["exportJSON"] = () => {
      const blob = new Blob([JSON.stringify(ref.current, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tempo-backup-${todayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return {
      state,
      projects: [...new Set(state.tasks.map((t) => t.project))].sort(),
      addTask, patchTask, setStatus, completeTask, reopenTask, deleteTask, duplicateTask,
      addNote, addLink, removeLink, addSubtasks, toggleSubtask, removeSubtask,
      setPlannedFor, setSettings, resetAll, exportJSON,
    };
  }, [state, commit]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

/** Applies a status change; when a recurring task is completed, spawns the next occurrence. */
function withTaskRecurrence(s: AppState, id: string, status: Status, actualMinutes?: number): AppState {
  const prev = s.tasks.find((t) => t.id === id);
  if (!prev) return s;
  const events: ActivityEvent[] = [mkEvent(id, "status", `Status → ${STATUS_META[status].label}`)];
  let next: Task = { ...prev, status, updatedAt: new Date().toISOString() };
  let spawned: Task | null = null;

  if (status === "inprogress") next.inProgressSince = new Date().toISOString();
  else next.inProgressSince = null;

  if (status === "done") {
    next.completedAt = new Date().toISOString();
    next.actualMinutes = actualMinutes ?? prev.actualMinutes ?? prev.estimatedMinutes;
    events.push(mkEvent(id, "completed", `Completed in ${fmtMinutes(next.actualMinutes)} (est ${fmtMinutes(prev.estimatedMinutes)})`));
    if (prev.recurrence !== "none") {
      const base = prev.dueDate ?? todayISO();
      spawned = {
        ...prev,
        id: uid(),
        status: "todo",
        dueDate: nextOccurrence(base, prev.recurrence),
        completedAt: null,
        actualMinutes: null,
        inProgressSince: null,
        plannedFor: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subtasks: prev.subtasks.map((st) => ({ ...st, id: uid(), done: false })),
      };
      events.push(mkEvent(spawned.id, "recurrence", `Recurring (${prev.recurrence}) — next occurrence due ${fmtDate(spawned.dueDate)}`));
    }
  }

  return {
    ...s,
    tasks: spawned
      ? [spawned, ...s.tasks.map((t) => (t.id === id ? next : t))]
      : s.tasks.map((t) => (t.id === id ? next : t)),
    activity: [...events, ...s.activity],
  };
}

/* --------------------------------- Toasts -------------------------------- */

export interface Toast {
  id: string;
  kind: "success" | "info" | "warn";
  title: string;
  detail?: string;
}

interface ToastValue {
  toasts: Toast[];
  push: (kind: Toast["kind"], title: string, detail?: string) => void;
  dismiss: (id: string) => void;
}

const ToastCtx = createContext<ToastValue | null>(null);

export function useToasts(): ToastValue {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("useToasts outside provider");
  return v;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback((kind: Toast["kind"], title: string, detail?: string) => {
    const id = uid();
    setToasts((t) => [...t.slice(-3), { id, kind, title, detail }]);
    window.setTimeout(() => dismiss(id), 4600);
  }, [dismiss]);

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 w-[320px] pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="anim-toast pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-card px-3.5 py-3 shadow-lg shadow-ink/10"
          >
            <span className="mt-0.5 shrink-0">
              {t.kind === "success" && <CheckCircle2 size={17} className="text-doneg" />}
              {t.kind === "info" && <Info size={17} className="text-steel" />}
              {t.kind === "warn" && <AlertTriangle size={17} className="text-tang" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug text-ink">{t.title}</p>
              {t.detail && <p className="mt-0.5 text-xs leading-snug text-inksoft">{t.detail}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 text-inkfaint hover:text-ink transition-colors" aria-label="Dismiss">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* --------------------------------- Hooks --------------------------------- */

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
