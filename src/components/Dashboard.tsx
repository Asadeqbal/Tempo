import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Compass, Flag, Gauge, Hourglass,
  Lock, MoonStar, Sparkles, Trophy, Users, Inbox,
} from "lucide-react";
import type { Insight, Task, ViewName } from "../types";
import { useStore } from "../store";
import {
  buildInsights, endOfDaySummary, getNextUp, getReminders, greeting, scoreTask, workloadFor,
} from "../lib/engine";
import { addDaysISO, fmtDate, fmtDateLong, fmtMinutes, todayISO, toISODate, dueLabel, lastNDays, weekdayShort } from "../lib/dates";
import { EmptyState, ProgressBar, ScoreMeter, SectionHead, DueChip, TaskCheck, PriorityBadge, Modal, ModalHeader } from "./ui";
import TaskRow from "./TaskRow";

interface Props {
  onOpenTask: (id: string) => void;
  onNavigate: (v: ViewName) => void;
  onNewTask: () => void;
  onStartFocus: () => void;
}

const KIND_ICON: Record<Insight["kind"], React.ReactNode> = {
  next: <Compass size={15} />,
  warn: <AlertTriangle size={15} />,
  risk: <Hourglass size={15} />,
  block: <Lock size={15} />,
  load: <Gauge size={15} />,
  win: <Trophy size={15} />,
  info: <Sparkles size={15} />,
};

const KIND_CLS: Record<Insight["kind"], string> = {
  next: "border-pine/30 bg-pinemist/60 text-pinedeep",
  warn: "border-ember/30 bg-embermist/70 text-ember",
  risk: "border-tang/30 bg-tangmist/70 text-tang",
  block: "border-rust/30 bg-rustmist/70 text-rust",
  load: "border-amber/30 bg-ambrmist/70 text-amber",
  win: "border-doneg/30 bg-donemist/70 text-doneg",
  info: "border-steel/30 bg-steelmist/70 text-steel",
};

export default function Dashboard({ onOpenTask, onNavigate, onNewTask, onStartFocus }: Props) {
  const { state } = useStore();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const today = todayISO();

  const tasks = state.tasks;
  const insights = useMemo(() => buildInsights(tasks, state.settings), [tasks, state.settings]);
  const reminders = useMemo(() => getReminders(tasks), [tasks]);
  const next = useMemo(() => getNextUp(tasks), [tasks]);
  const load = useMemo(() => workloadFor(tasks, state.settings, today), [tasks, state.settings, today]);

  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const upcoming = open
    .filter((t) => t.dueDate && t.dueDate > today && t.dueDate <= addDaysISO(today, 7))
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).slice(0, 6);
  const waiting = open.filter((t) => t.status === "waiting");
  const recentDone = tasks.filter((t) => t.status === "done").sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")).slice(0, 5);
  const doneToday = tasks.filter((t) => t.completedAt && toISODate(new Date(t.completedAt)) === today);
  const doneTodayMin = doneToday.reduce((a, t) => a + (t.actualMinutes ?? t.estimatedMinutes), 0);
  const planSorted = [...load.tasks].sort((a, b) => scoreTask(b, tasks).score - scoreTask(a, tasks).score);
  const summaryLines = useMemo(() => endOfDaySummary(tasks, state.activity), [tasks, state.activity]);
  const spark = useMemo(() => {
    const days = lastNDays(7);
    return days.map((d) => ({
      d,
      n: tasks.filter((t) => t.completedAt && toISODate(new Date(t.completedAt)) === d).length,
    }));
  }, [tasks]);
  const sparkMax = Math.max(1, ...spark.map((s) => s.n));

  const tone = load.ratio > 1 ? "ember" : load.ratio > 0.8 ? "tang" : "pine";

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      {/* Main column */}
      <div className="space-y-5 xl:col-span-7">
        {/* Briefing */}
        <section className="anim-rise relative overflow-hidden rounded-xl border border-line bg-night p-6 text-nighttext shadow-lg shadow-night/20">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-pine/20 blur-3xl anim-breathe" />
          <div className="pointer-events-none absolute -bottom-24 right-24 h-44 w-44 rounded-full bg-mint/10 blur-3xl" />
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mint">{fmtDateLong(today)}</p>
          <h1 className="mt-1.5 font-display text-[28px] font-bold leading-tight text-white sm:text-[32px]">
            {greeting()}, {state.settings.userName}.
          </h1>
          <p className="mt-1 max-w-md text-[13.5px] leading-relaxed text-nighttext">
            {overdue.length
              ? `${overdue.length} overdue, ${doneToday.length} done — the day needs triage before new work.`
              : open.length
                ? `${open.length} open tasks, ${doneToday.length} already completed. Here's where to aim.`
                : "The board is clear. A rare and beautiful sight."}
          </p>
          <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
            <Stat big label="completed today" value={`${doneToday.length}`} sub={fmtMinutes(doneTodayMin)} />
            <Stat label="open" value={`${open.length}`} />
            <Stat label="overdue" value={`${overdue.length}`} alert={overdue.length > 0} />
            <Stat label="signals" value={`${reminders.length}`} alert={reminders.some((r) => r.severity === "critical")} />
          </div>
        </section>

        {/* Assistant */}
        <section className="anim-rise" style={{ animationDelay: "60ms" }}>
          <SectionHead
            title="Assistant"
            right={
              <button onClick={() => setSummaryOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1 text-[11px] font-semibold text-inksoft transition-all hover:border-night hover:text-night active:scale-95">
                <MoonStar size={11} /> End-of-day summary
              </button>
            }
          />
          <div className="space-y-2">
            {insights.map((ins, i) => (
              <div key={ins.id} className={`anim-rise flex items-start gap-3 rounded-xl border p-3.5 ${KIND_CLS[ins.kind]}`} style={{ animationDelay: `${90 + i * 50}ms` }}>
                <span className="mt-0.5 shrink-0">{KIND_ICON[ins.kind]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold leading-snug">{ins.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink/70">{ins.body}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ins.taskId && (
                      <button onClick={() => onOpenTask(ins.taskId!)}
                        className="inline-flex items-center gap-1 rounded-md bg-ink/8 px-2 py-1 text-[11px] font-semibold text-ink transition-all hover:bg-ink/15 active:scale-95">
                        Open task <ArrowRight size={10} />
                      </button>
                    )}
                    {ins.action && (
                      <button onClick={() => onNavigate(ins.action!.view as ViewName)}
                        className="inline-flex items-center gap-1 rounded-md bg-ink/8 px-2 py-1 text-[11px] font-semibold text-ink transition-all hover:bg-ink/15 active:scale-95">
                        {ins.action.label} <ArrowRight size={10} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Today's plan */}
        <section className="anim-rise" style={{ animationDelay: "120ms" }}>
          <SectionHead
            title="Today's workload"
            count={planSorted.length}
            right={
              <button onClick={() => onNavigate("plan")} className="inline-flex items-center gap-1 text-[11px] font-semibold text-pine transition-colors hover:text-pinedeep">
                Plan my day <ArrowRight size={11} />
              </button>
            }
          />
          <div className="rounded-xl border border-line bg-card p-4 shadow-sm">
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-mono text-[11px] text-inksoft">
                {fmtMinutes(load.plannedMin)} planned <span className="text-inkfaint">of {fmtMinutes(load.capacityMin)} capacity</span>
              </span>
              <span className={`font-mono text-[11px] font-semibold ${tone === "ember" ? "text-ember" : tone === "tang" ? "text-tang" : "text-pine"}`}>
                {Math.round(load.ratio * 100)}%
              </span>
            </div>
            <ProgressBar value={load.ratio} tone={tone} className="mb-3" />
            {planSorted.length ? (
              <div className="space-y-1">
                {planSorted.slice(0, 7).map((t, i) => (
                  <TaskRow key={t.id} task={t} all={tasks} onOpen={onOpenTask} showScore delay={i * 35} />
                ))}
                {planSorted.length > 7 && (
                  <p className="pt-1 text-center font-mono text-[10.5px] text-inkfaint">+{planSorted.length - 7} more in the day plan</p>
                )}
              </div>
            ) : (
              <EmptyState icon={<Inbox size={26} />} title="Nothing scheduled for today"
                hint="Pull in due work or plan tomorrow from the day planner."
                action={<button onClick={onNavigate.bind(null, "plan")} className="mt-1 rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-white hover:bg-pinedeep">Open day planner</button>} />
            )}
          </div>
        </section>
      </div>

      {/* Side column */}
      <div className="space-y-5 xl:col-span-5">
        {/* Next up card */}
        {next && (
          <section className="anim-rise" style={{ animationDelay: "80ms" }}>
            <SectionHead title="Up next" />
            <div className="group relative overflow-hidden rounded-xl border border-pine/30 bg-card p-4 shadow-sm transition-all hover:shadow-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-pine" />
              <div className="pl-2">
                <div className="flex items-center gap-2">
                  <ScoreMeter score={next.score} />
                  <PriorityBadge p={next.task.priority} />
                  <DueChip due={next.task.dueDate} />
                </div>
                <h3 className="mt-2 font-display text-[17px] font-semibold leading-snug text-ink">{next.task.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-inksoft">
                  {next.reasons.slice(0, 3).join(" · ")} · est {fmtMinutes(next.task.estimatedMinutes)} · {next.task.project}
                </p>
                <div className="mt-3 flex gap-2">
                  <button onClick={onStartFocus}
                    className="anim-pulsering inline-flex items-center gap-1.5 rounded-lg bg-pine px-3.5 py-2 text-xs font-bold text-white transition-all hover:bg-pinedeep active:scale-95">
                    Start focus session
                  </button>
                  <button onClick={() => onOpenTask(next.task.id)}
                    className="rounded-lg border border-line px-3 py-2 text-xs font-semibold text-inksoft transition-colors hover:border-pine hover:text-pine">
                    Open
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Overdue */}
        <section className="anim-rise" style={{ animationDelay: "110ms" }}>
          <SectionHead title="Overdue" count={overdue.length} />
          {overdue.length ? (
            <div className="space-y-1">
              {overdue.slice(0, 5).map((t) => <MiniRow key={t.id} t={t} onOpen={onOpenTask} />)}
            </div>
          ) : (
            <QuietNote icon={<CheckCircle2 size={14} />} text="Nothing overdue. Keep it that way." />
          )}
        </section>

        {/* Upcoming */}
        <section className="anim-rise" style={{ animationDelay: "140ms" }}>
          <SectionHead title="Upcoming deadlines" count={upcoming.length} />
          {upcoming.length ? (
            <div className="space-y-1">
              {upcoming.map((t) => <MiniRow key={t.id} t={t} onOpen={onOpenTask} showDate />)}
            </div>
          ) : (
            <QuietNote icon={<CheckCircle2 size={14} />} text="No deadlines in the next 7 days." />
          )}
        </section>

        {/* Waiting */}
        <section className="anim-rise" style={{ animationDelay: "170ms" }}>
          <SectionHead title="Waiting on others" count={waiting.length} />
          {waiting.length ? (
            <div className="space-y-1">
              {waiting.map((t) => <MiniRow key={t.id} t={t} onOpen={onOpenTask} icon={<Users size={11} className="text-amber" />} />)}
            </div>
          ) : (
            <QuietNote icon={<CheckCircle2 size={14} />} text="No tasks blocked on other people." />
          )}
        </section>

        {/* Recently completed */}
        <section className="anim-rise" style={{ animationDelay: "200ms" }}>
          <SectionHead title="Recently completed" count={recentDone.length} />
          <div className="rounded-xl border border-line bg-card p-3 shadow-sm">
            {recentDone.length ? (
              <ul className="space-y-2">
                {recentDone.map((t) => (
                  <li key={t.id} onClick={() => onOpenTask(t.id)} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-0.5 transition-colors hover:bg-mist">
                    <CheckCircle2 size={14} className="shrink-0 text-doneg" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-inksoft">{t.title}</span>
                    <span className="font-mono text-[10.5px] text-inkfaint">
                      {t.actualMinutes != null && (
                        <span className={t.actualMinutes > t.estimatedMinutes ? "text-tang" : "text-doneg"}>
                          {fmtMinutes(t.actualMinutes)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1 py-2 text-xs text-inkfaint">Completed tasks will appear here.</p>
            )}
            {/* 7-day spark */}
            <div className="mt-3 border-t border-linesoft pt-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Completions · last 7 days</p>
              <div className="flex h-14 items-end gap-1.5">
                {spark.map((s, i) => (
                  <div key={s.d} className="group/bar flex flex-1 flex-col items-center gap-1">
                    <span className="font-mono text-[9.5px] text-inkfaint opacity-0 transition-opacity group-hover/bar:opacity-100">{s.n}</span>
                    <div className={`w-full rounded-sm transition-all duration-500 ${s.d === today ? "bg-pine" : "bg-pine/30 group-hover/bar:bg-pine/60"}`}
                      style={{ height: `${Math.max(6, (s.n / sparkMax) * 36)}px`, transitionDelay: `${i * 40}ms` }} />
                    <span className="font-mono text-[9px] text-inkfaint">{weekdayShort(s.d)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* End of day summary modal */}
      <Modal open={summaryOpen} onClose={() => setSummaryOpen(false)}>
        <ModalHeader kicker="Assistant" title="End-of-day summary" onClose={() => setSummaryOpen(false)} />
        <div className="px-5 py-4">
          <ul className="space-y-2.5">
            {summaryLines.map((l, i) => (
              <li key={i} className="anim-rise flex items-start gap-2.5 text-[13.5px] leading-relaxed text-ink" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-pine" />
                {l}
              </li>
            ))}
          </ul>
          <button onClick={() => { setSummaryOpen(false); onNavigate("reports"); }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-night px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-night2 active:scale-95">
            Open full reports <ArrowRight size={11} />
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ label, value, sub, big, alert }: { label: string; value: string; sub?: string; big?: boolean; alert?: boolean }) {
  return (
    <div>
      <p className={`font-display font-bold leading-none ${big ? "text-[38px] text-mint" : "text-[24px] text-white"} ${alert ? "!text-[#f0a48f]" : ""}`}>
        {value}{sub && <span className="ml-1.5 font-mono text-[12px] font-medium text-nighttext">{sub}</span>}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-nighttext/70">{label}</p>
    </div>
  );
}

function MiniRow({ t, onOpen, showDate, icon }: { t: Task; onOpen: (id: string) => void; showDate?: boolean; icon?: React.ReactNode }) {
  const due = dueLabel(t.dueDate);
  return (
    <div onClick={() => onOpen(t.id)}
      className="anim-fade group flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent bg-card px-3 py-2 transition-all hover:-translate-y-px hover:border-line hover:shadow-md hover:shadow-ink/5">
      {icon ?? <Flag size={11} className={due.tone === "over" ? "text-ember" : "text-inkfaint"} />}
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{t.title}</span>
      {showDate && t.dueDate && (
        <span className="font-mono text-[10.5px] text-inksoft">{fmtDate(t.dueDate)}</span>
      )}
      <DueChip due={t.dueDate} />
    </div>
  );
}

function QuietNote({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-line bg-paper/60 px-3 py-2.5 text-[12px] text-inkfaint">
      <span className="text-doneg">{icon}</span> {text}
    </div>
  );
}
