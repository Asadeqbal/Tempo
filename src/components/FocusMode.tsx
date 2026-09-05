import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CheckCircle2, ChevronRight, Pause, Play, RotateCcw, Target, Timer, X,
} from "lucide-react";
import { useStore, useToasts } from "../store";
import { getNextUp, rankOpen, isActionable, byIdMap } from "../lib/engine";
import { fmtMinutes } from "../lib/dates";
import { PriorityBadge, ProjectChip, TagChip, ProgressBar, Kbd } from "./ui";

interface Props {
  open: boolean;
  initialTaskId?: string | null;
  onClose: () => void;
}

export default function FocusMode({ open, initialTaskId, onClose }: Props) {
  const { state, completeTask, setStatus, toggleSubtask } = useStore();
  const { push } = useToasts();
  const byId = byIdMap(state.tasks);

  const ranked = useMemo(
    () => rankOpen(state.tasks).filter((r) => isActionable(r.task, byId)),
    [state.tasks, byId]
  );
  const nextUp = useMemo(() => getNextUp(state.tasks), [state.tasks]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (open) {
      const first = initialTaskId && state.tasks.some((t) => t.id === initialTaskId && t.status !== "done")
        ? initialTaskId
        : ranked[0]?.task.id ?? null;
      setActiveId(first);
      setSeconds(0);
      setRunning(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTaskId]);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const task = state.tasks.find((t) => t.id === activeId) ?? null;
  if (!open) return null;

  const trackedMin = Math.max(1, Math.round(seconds / 60));
  const doneSubs = task?.subtasks.filter((s) => s.done).length ?? 0;

  const finish = () => {
    if (!task) return;
    const mins = seconds > 30 ? trackedMin : task.estimatedMinutes;
    completeTask(task.id, mins);
    setRunning(false);
    setSeconds(0);
    push("success", "Focus session complete", `“${task.title}” done — logged ${fmtMinutes(mins)}`);
    const nextTask = ranked.find((r) => r.task.id !== task.id);
    setActiveId(nextTask?.task.id ?? null);
  };

  const skip = () => {
    const idx = ranked.findIndex((r) => r.task.id === activeId);
    const nextTask = ranked[(idx + 1) % Math.max(1, ranked.length)];
    setActiveId(nextTask?.task.id ?? null);
    setSeconds(0);
    setRunning(false);
  };

  const fmtClock = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[65] overflow-y-auto bg-night/97">
      <div className="dotfield pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pine/15 blur-3xl anim-breathe" />

      <div className="relative mx-auto flex min-h-full w-full max-w-2xl flex-col px-5 py-8">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-mint">
            <Target size={13} /> Focus mode
          </p>
          <button onClick={onClose} className="inline-flex items-center gap-1.5 rounded-lg border border-nightline px-3 py-1.5 text-xs font-medium text-nighttext transition-colors hover:border-mint/50 hover:text-white">
            Exit <Kbd dark>Esc</Kbd>
          </button>
        </div>

        {task ? (
          <div className="anim-pop mt-10 flex flex-1 flex-col items-center text-center">
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <ProjectChip name={task.project} />
              <PriorityBadge p={task.priority} />
              {task.tags.slice(0, 3).map((t) => <TagChip key={t} tag={t} />)}
            </div>
            <h2 className="mt-4 max-w-xl font-display text-[28px] font-bold leading-tight text-white sm:text-[32px]">
              {task.title}
            </h2>
            {task.description && (
              <p className="mt-3 max-w-lg text-[13.5px] leading-relaxed text-nighttext">{task.description}</p>
            )}

            {/* Timer */}
            <div className="mt-9 flex flex-col items-center">
              <div className={`flex h-44 w-44 items-center justify-center rounded-full border-2 transition-all duration-500
                ${running ? "border-mint/70 anim-pulsering" : "border-nightline"}`}>
                <div className="flex flex-col items-center">
                  <span key={seconds} className="anim-tick font-mono text-[40px] font-semibold tabular-nums tracking-tight text-white">
                    {fmtClock(seconds)}
                  </span>
                  <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-nighttext">
                    est {fmtMinutes(task.estimatedMinutes)}
                    {seconds > 30 && (
                      <span className={trackedMin > task.estimatedMinutes ? "text-[#f0a48f]" : "text-mint"}> · {fmtMinutes(trackedMin)} tracked</span>
                    )}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2.5">
                <button onClick={() => setRunning((r) => !r)}
                  className="inline-flex items-center gap-2 rounded-xl bg-mint px-5 py-2.5 text-sm font-bold text-night transition-all hover:brightness-110 active:scale-95">
                  {running ? <Pause size={15} /> : <Play size={15} />} {running ? "Pause" : seconds > 0 ? "Resume" : "Start timer"}
                </button>
                {seconds > 0 && (
                  <button onClick={() => { setSeconds(0); setRunning(false); }}
                    className="rounded-xl border border-nightline p-2.5 text-nighttext transition-colors hover:border-mint/50 hover:text-white" aria-label="Reset timer">
                    <RotateCcw size={15} />
                  </button>
                )}
              </div>
              <div className="mt-5 flex items-center gap-2.5">
                <button onClick={finish}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-doneg px-4 py-2 text-[13px] font-bold text-white transition-all hover:brightness-110 active:scale-95">
                  <CheckCircle2 size={14} /> Mark done{seconds > 30 ? ` · log ${fmtMinutes(trackedMin)}` : ""}
                </button>
                <button onClick={skip}
                  className="inline-flex items-center gap-1 rounded-xl border border-nightline px-4 py-2 text-[13px] font-medium text-nighttext transition-colors hover:border-mint/50 hover:text-white">
                  Skip <ChevronRight size={13} />
                </button>
              </div>
              {task.status === "todo" && (
                <button onClick={() => setStatus(task.id, "inprogress")}
                  className="mt-2 text-[11px] font-medium text-nighttext/70 underline-offset-4 transition-colors hover:text-mint hover:underline">
                  Also mark this task as In Progress
                </button>
              )}
            </div>

            {/* Subtasks */}
            {task.subtasks.length > 0 && (
              <div className="mt-9 w-full max-w-md rounded-xl border border-nightline bg-night2/80 p-4 text-left">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-nighttext">Subtasks</p>
                  <span className="font-mono text-[10.5px] text-mint">{doneSubs}/{task.subtasks.length}</span>
                </div>
                <ProgressBar value={task.subtasks.length ? doneSubs / task.subtasks.length : 0} className="mb-2.5 !bg-nightline" />
                <ul className="space-y-1">
                  {task.subtasks.map((s) => (
                    <li key={s.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-[12.5px] text-nighttext transition-colors hover:bg-night/60">
                        <input type="checkbox" checked={s.done} onChange={() => toggleSubtask(task.id, s.id)} className="accent-[#54c29a]" />
                        <span className={s.done ? "text-nighttext/50 line-through" : ""}>{s.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-24 flex flex-1 flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-night2 text-mint"><Timer size={26} /></div>
            <h2 className="mt-5 font-display text-2xl font-bold text-white">All clear</h2>
            <p className="mt-2 max-w-sm text-[13.5px] leading-relaxed text-nighttext">
              No actionable tasks left. Everything is done, waiting on others, or blocked. Take the win.
            </p>
          </div>
        )}

        {/* Next in queue */}
        {ranked.length > 1 && task && (
          <div className="mt-10 rounded-xl border border-nightline bg-night2/60 p-3.5">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-nighttext">
              Next in the queue {nextUp && nextUp.task.id !== task.id && <ArrowRight size={10} className="inline" />}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ranked.filter((r) => r.task.id !== task.id).slice(0, 5).map((r) => (
                <button key={r.task.id} onClick={() => { setActiveId(r.task.id); setSeconds(0); setRunning(false); }}
                  className="max-w-[240px] truncate rounded-lg border border-nightline px-2.5 py-1.5 text-[11.5px] font-medium text-nighttext transition-all hover:border-mint/60 hover:text-white active:scale-95">
                  <span className="mr-1.5 font-mono text-[10px] text-mint">{r.score}</span>
                  {r.task.title}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 text-center">
          <button onClick={onClose} className="text-[11px] text-nighttext/60 transition-colors hover:text-mint">
            or press Esc to return to the cockpit
          </button>
        </div>
      </div>
    </div>
  );
}
