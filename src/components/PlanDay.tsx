import { useMemo } from "react";
import { CalendarDays, ChevronRight, Minus, Plus, Wand2, Eraser } from "lucide-react";
import { useStore, useToasts } from "../store";
import { rankOpen, scoreTask } from "../lib/engine";
import { fmtDateLong, fmtMinutes, todayISO } from "../lib/dates";
import { DueChip, PriorityBadge, ProgressBar, ScoreMeter, SectionHead, EmptyState } from "./ui";

export default function PlanDay({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { state, setPlannedFor, setSettings } = useStore();
  const { push } = useToasts();
  const today = todayISO();
  const tasks = state.tasks;
  const capacityMin = state.settings.workdayHours * 60;

  const planned = useMemo(
    () => tasks
      .filter((t) => t.plannedFor === today && t.status !== "done")
      .map((t) => ({ t, s: scoreTask(t, tasks) }))
      .sort((a, b) => b.s.score - a.s.score),
    [tasks, today]
  );
  const plannedMin = planned.reduce((a, x) => a + x.t.estimatedMinutes, 0);

  const mustDo = useMemo(
    () => tasks.filter(
      (t) => t.status !== "done" && t.plannedFor !== today && t.dueDate && t.dueDate <= today
    ).map((t) => ({ t, s: scoreTask(t, tasks) })).sort((a, b) => b.s.score - a.s.score),
    [tasks, today]
  );

  const backlog = useMemo(
    () => rankOpen(tasks).filter(
      (r) => r.task.plannedFor !== today && !(r.task.dueDate && r.task.dueDate <= today) && r.task.status !== "blocked"
    ),
    [tasks, today]
  );

  const ratio = capacityMin ? plannedMin / capacityMin : 0;
  const tone = ratio > 1 ? "ember" : ratio > 0.8 ? "tang" : "pine";
  const remaining = capacityMin - plannedMin;

  const autoPlan = () => {
    let room = remaining;
    let added = 0;
    const pool = [...mustDo, ...backlog.map((r) => ({ t: r.task, s: r }))];
    for (const { t } of pool) {
      if (room <= 0) break;
      setPlannedFor(t.id, today);
      room -= t.estimatedMinutes;
      added++;
    }
    push("success", added ? `Auto-planned ${added} task${added > 1 ? "s" : ""}` : "Day already full",
      added ? `Highest-scored work that fits in ${fmtMinutes(capacityMin)} pulled in first.` : "Everything that fits is already on the plan.");
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-pine">
            <CalendarDays size={12} /> Daily planning
          </p>
          <h2 className="mt-0.5 font-display text-xl font-bold text-ink">{fmtDateLong(today)}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] text-inksoft">
            Workday
            <button onClick={() => setSettings({ workdayHours: Math.max(2, state.settings.workdayHours - 1) })}
              className="rounded p-0.5 transition-colors hover:bg-mist" aria-label="Decrease workday hours"><Minus size={12} /></button>
            <span className="w-6 text-center font-mono font-semibold text-ink">{state.settings.workdayHours}h</span>
            <button onClick={() => setSettings({ workdayHours: Math.min(14, state.settings.workdayHours + 1) })}
              className="rounded p-0.5 transition-colors hover:bg-mist" aria-label="Increase workday hours"><Plus size={12} /></button>
          </span>
          <button onClick={autoPlan}
            className="inline-flex items-center gap-1.5 rounded-lg bg-night px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-night2 active:scale-95">
            <Wand2 size={12} /> Auto-plan my day
          </button>
          {planned.length > 0 && (
            <button onClick={() => { planned.forEach(({ t }) => setPlannedFor(t.id, null)); push("info", "Day plan cleared"); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-inksoft transition-all hover:border-ember hover:text-ember active:scale-95">
              <Eraser size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Capacity */}
      <div className="mb-5 rounded-xl border border-line bg-card p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="text-[13px] font-medium text-ink">
            {fmtMinutes(plannedMin)} <span className="text-inkfaint">committed of {fmtMinutes(capacityMin)}</span>
            {remaining >= 0
              ? <span className="ml-2 font-mono text-[11px] text-pine">{fmtMinutes(remaining)} of slack</span>
              : <span className="ml-2 font-mono text-[11px] font-semibold text-ember">{fmtMinutes(-remaining)} over — something will slip</span>}
          </p>
          <span className={`font-mono text-sm font-bold ${tone === "ember" ? "text-ember" : tone === "tang" ? "text-tang" : "text-pine"}`}>
            {Math.round(ratio * 100)}%
          </span>
        </div>
        <ProgressBar value={ratio} tone={tone} className="mt-2" />
        <div className="mt-2 flex gap-4 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-pine" /> realistic</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-tang" /> tight</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ember" /> unrealistic</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Planned */}
        <section>
          <SectionHead title="Committed today" count={planned.length} />
          <div className="space-y-1.5">
            {planned.map(({ t, s }, i) => (
              <div key={t.id} className="anim-rise group flex items-center gap-2.5 rounded-lg border border-line bg-card px-3 py-2.5 transition-all hover:-translate-y-px hover:shadow-md hover:shadow-ink/5"
                style={{ animationDelay: `${i * 30}ms` }}>
                <ScoreMeter score={s.score} />
                <button onClick={() => onOpenTask(t.id)} className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-ink hover:text-pine">
                  {t.title}
                </button>
                <DueChip due={t.dueDate} />
                <span className="font-mono text-[10.5px] text-inksoft">{fmtMinutes(t.estimatedMinutes)}</span>
                <button onClick={() => setPlannedFor(t.id, null)}
                  className="rounded p-1 text-inkfaint opacity-0 transition-all hover:bg-embermist hover:text-ember group-hover:opacity-100" aria-label="Remove from plan">
                  <Minus size={12} />
                </button>
              </div>
            ))}
            {planned.length === 0 && (
              <EmptyState icon={<CalendarDays size={24} />} title="No commitments yet"
                hint="Auto-plan pulls the highest-scored work that fits your workday, or add tasks manually from the right." />
            )}
          </div>

          {mustDo.length > 0 && (
            <>
              <SectionHead title="Must handle — overdue or due today" count={mustDo.length} />
              <div className="space-y-1.5">
                {mustDo.map(({ t, s }) => (
                  <div key={t.id} className="flex items-center gap-2.5 rounded-lg border border-ember/25 bg-embermist/40 px-3 py-2.5">
                    <ScoreMeter score={s.score} />
                    <button onClick={() => onOpenTask(t.id)} className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-ink hover:text-pine">
                      {t.title}
                    </button>
                    <DueChip due={t.dueDate} />
                    <button onClick={() => { setPlannedFor(t.id, today); push("success", "Added to today's plan", t.title); }}
                      className="inline-flex items-center gap-1 rounded-md bg-ember px-2 py-1 text-[10.5px] font-bold text-white transition-all hover:brightness-110 active:scale-95">
                      <Plus size={10} /> plan
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Backlog candidates */}
        <section>
          <SectionHead title="Best candidates" count={backlog.length} />
          <div className="space-y-1.5">
            {backlog.slice(0, 14).map(({ task, score, reasons }, i) => (
              <div key={task.id} className="anim-rise flex items-center gap-2.5 rounded-lg border border-line bg-card px-3 py-2.5 transition-all hover:-translate-y-px hover:shadow-md hover:shadow-ink/5"
                style={{ animationDelay: `${i * 25}ms` }}>
                <ScoreMeter score={score} />
                <div className="min-w-0 flex-1">
                  <button onClick={() => onOpenTask(task.id)} className="block w-full truncate text-left text-[13px] font-medium text-ink hover:text-pine">
                    {task.title}
                  </button>
                  <p className="truncate font-mono text-[10px] text-inkfaint">{reasons.slice(0, 2).join(" · ")} · est {fmtMinutes(task.estimatedMinutes)}</p>
                </div>
                <PriorityBadge p={task.priority} />
                <button
                  onClick={() => { setPlannedFor(task.id, today); push("success", "Added to today's plan", task.title); }}
                  className="inline-flex items-center gap-0.5 rounded-md border border-line px-2 py-1 text-[10.5px] font-semibold text-inksoft transition-all hover:border-pine hover:bg-pinemist hover:text-pinedeep active:scale-95">
                  <Plus size={10} /> plan
                </button>
              </div>
            ))}
            {backlog.length === 0 && (
              <EmptyState icon={<ChevronRight size={24} />} title="Backlog is empty"
                hint="Every open task is already planned, due, or blocked. Capture more work or enjoy the calm." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
