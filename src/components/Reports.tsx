import { useMemo } from "react";
import { BarChart3, GitBranch, Hourglass, TrendingUp } from "lucide-react";
import { useStore } from "../store";
import { projectTime, weeklyStats, byIdMap, dependentsOf } from "../lib/engine";
import { fmtMinutes, lastNDays, toISODate, todayISO, weekdayShort, fmtDate } from "../lib/dates";
import { SectionHead, EmptyState } from "./ui";

export default function Reports() {
  const { state } = useStore();
  const tasks = state.tasks;
  const today = todayISO();

  const stats = useMemo(() => weeklyStats(tasks), [tasks]);
  const pTime = useMemo(() => projectTime(tasks), [tasks]);
  const monthPrefix = today.slice(0, 7);
  const doneThisMonth = tasks.filter((t) => t.completedAt && toISODate(new Date(t.completedAt)).startsWith(monthPrefix));
  const last7 = stats.perDay.slice(-7);
  const weekDone = last7.reduce((a, d) => a + d.completed, 0);
  const weekMin = last7.reduce((a, d) => a + d.minutes, 0);
  const maxDay = Math.max(1, ...stats.perDay.map((d) => d.completed));
  const maxProj = Math.max(1, ...pTime.map((p) => Math.max(p.est, p.actual)));
  const total = stats.open + stats.done;
  const doneRatio = total ? stats.done / total : 0;

  const review = useMemo(() => {
    const byId = byIdMap(tasks);
    const lines: { icon: React.ReactNode; text: string }[] = [];
    lines.push({
      icon: <TrendingUp size={13} />,
      text: `Completed ${weekDone} task${weekDone !== 1 ? "s" : ""} this week — roughly ${fmtMinutes(weekMin)} of shipped work.`,
    });
    const stalled = tasks
      .filter((t) => t.status === "inprogress" && t.inProgressSince)
      .sort((a, b) => a.inProgressSince!.localeCompare(b.inProgressSince!))[0];
    if (stalled) {
      const days = Math.floor((Date.now() - new Date(stalled.inProgressSince!).getTime()) / 86400000);
      if (days >= 2) lines.push({ icon: <Hourglass size={13} />, text: `Longest in-flight item: “${stalled.title}” — ${days} days in progress. Timebox it or split it.` });
    }
    const bottleneck = tasks
      .filter((t) => t.status !== "done")
      .map((t) => ({ t, n: dependentsOf(t.id, tasks).length }))
      .sort((a, b) => b.n - a.n)[0];
    if (bottleneck && bottleneck.n > 0)
      lines.push({ icon: <GitBranch size={13} />, text: `Biggest bottleneck: “${bottleneck.t.title}” — finishing it unblocks ${bottleneck.n} other task${bottleneck.n > 1 ? "s" : ""}.` });
    if (pTime[0])
      lines.push({ icon: <BarChart3 size={13} />, text: `Most time went to ${pTime[0].project} (${fmtMinutes(pTime[0].actual)} across ${pTime[0].count} tasks).` });
    if (stats.avgActual && stats.avgEst) {
      const drift = Math.round(((stats.avgActual - stats.avgEst) / stats.avgEst) * 100);
      lines.push({
        icon: <Hourglass size={13} />,
        text: drift > 10
          ? `Estimation drift: tasks take ~${drift}% longer than planned (avg ${fmtMinutes(stats.avgActual)} vs ${fmtMinutes(stats.avgEst)}). Pad future estimates.`
          : drift < -10
            ? `You're beating estimates by ~${Math.abs(drift)}% (avg ${fmtMinutes(stats.avgActual)} vs ${fmtMinutes(stats.avgEst)}). Room to plan more ambitiously.`
            : `Estimates are accurate: avg actual ${fmtMinutes(stats.avgActual)} vs planned ${fmtMinutes(stats.avgEst)}.`,
      });
    }
    return lines;
  }, [tasks, weekDone, weekMin, pTime, stats.avgActual, stats.avgEst]);

  return (
    <div className="space-y-5">
      {/* Stat strip */}
      <section className="anim-rise grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <div className="col-span-2 bg-night p-5 sm:col-span-1">
          <p className="font-display text-[34px] font-bold leading-none text-mint">{weekDone}</p>
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-nighttext/70">completed · 7 days</p>
          <p className="mt-1 font-mono text-[11px] text-nighttext">{fmtMinutes(weekMin)} of work</p>
        </div>
        <StatTile label="completed · month" value={`${doneThisMonth.length}`} />
        <StatTile label="open tasks" value={`${stats.open}`} sub={`${stats.done} done all-time`} />
        <StatTile label="avg completion" value={stats.avgActual ? fmtMinutes(stats.avgActual) : "—"} sub={stats.avgEst ? `est ${fmtMinutes(stats.avgEst)}` : undefined} />
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* 14-day throughput */}
        <section className="anim-rise rounded-xl border border-line bg-card p-4 shadow-sm lg:col-span-3" style={{ animationDelay: "50ms" }}>
          <SectionHead title="Throughput · last 14 days" />
          <div className="flex h-40 items-end gap-1.5 pt-4">
            {stats.perDay.map((d, i) => (
              <div key={d.date} className="group/bar flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span className="font-mono text-[9.5px] text-inkfaint opacity-0 transition-opacity group-hover/bar:opacity-100">
                  {d.completed}
                </span>
                <div className="flex w-full flex-col justify-end rounded-t-sm transition-all duration-500 group-hover/bar:opacity-100" style={{ height: "100%" }}>
                  <div className={`w-full rounded-t-sm ${d.date === today ? "bg-pine" : "bg-pine/35 group-hover/bar:bg-pine/70"}`}
                    style={{ height: `${Math.max(3, (d.completed / maxDay) * 100)}%`, transitionDelay: `${i * 25}ms` }} />
                </div>
                <span className="font-mono text-[8.5px] text-inkfaint">{weekdayShort(d.date).slice(0, 2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-linesoft pt-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Pending vs completed</p>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-linesoft">
                <div className="anim-bar h-full bg-doneg" style={{ width: `${doneRatio * 100}%` }} />
              </div>
              <p className="mt-1 font-mono text-[10.5px] text-inksoft">
                <span className="text-doneg">{stats.done} done</span> · <span className="text-inkfaint">{stats.open} open</span>
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Completion share</p>
              <p className="mt-1 font-display text-2xl font-bold text-ink">{Math.round(doneRatio * 100)}%</p>
              <p className="font-mono text-[10.5px] text-inkfaint">of everything captured</p>
            </div>
          </div>
        </section>

        {/* Est vs actual per project */}
        <section className="anim-rise rounded-xl border border-line bg-card p-4 shadow-sm lg:col-span-2" style={{ animationDelay: "90ms" }}>
          <SectionHead title="Planned vs actual by project" />
          {pTime.length ? (
            <div className="space-y-3.5 pt-1">
              {pTime.slice(0, 6).map((p) => (
                <div key={p.project}>
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-[12px] font-semibold text-ink">{p.project}</span>
                    <span className="font-mono text-[10.5px] text-inkfaint">{p.count} tasks · {fmtMinutes(p.actual)}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-linesoft">
                      <div className="anim-bar h-full rounded-full bg-pine" style={{ width: `${(p.actual / maxProj) * 100}%` }} />
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-linesoft">
                      <div className="anim-bar h-full rounded-full bg-pine/35" style={{ width: `${(p.est / maxProj) * 100}%`, animationDelay: "120ms" }} />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-4 border-t border-linesoft pt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-inkfaint">
                <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-pine" /> actual</span>
                <span className="flex items-center gap-1"><span className="h-1.5 w-3 rounded-full bg-pine/35" /> planned</span>
              </div>
            </div>
          ) : (
            <EmptyState icon={<BarChart3 size={22} />} title="No completed work yet" hint="Project time appears once tasks are completed with actuals." />
          )}
        </section>
      </div>

      {/* Weekly review */}
      <section className="anim-rise rounded-xl border border-line bg-night p-5 text-nighttext shadow-lg shadow-night/15" style={{ animationDelay: "130ms" }}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-mint">Weekly review</h3>
          <span className="font-mono text-[10.5px] text-nighttext/70">{fmtDate(last7[0].date)} — {fmtDate(today)}</span>
        </div>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {review.map((r, i) => (
            <li key={i} className="anim-rise flex items-start gap-2.5 rounded-lg border border-nightline bg-night2/70 p-3 text-[12.5px] leading-relaxed text-nighttext"
              style={{ animationDelay: `${160 + i * 60}ms` }}>
              <span className="mt-0.5 shrink-0 text-mint">{r.icon}</span>
              {r.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card p-5">
      <p className="font-display text-[26px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-inkfaint">{label}</p>
      {sub && <p className="mt-1 font-mono text-[11px] text-inksoft">{sub}</p>}
    </div>
  );
}
