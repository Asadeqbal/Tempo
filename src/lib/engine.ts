import type {
  ActivityEvent,
  Insight,
  Priority,
  Reminder,
  Settings,
  Status,
  Task,
} from "../types";
import {
  daysFromToday,
  fmtMinutes,
  fmtDate,
  todayISO,
  toISODate,
  lastNDays,
} from "./dates";

export const PRIORITY_META: Record<
  Priority,
  { label: string; weight: number; chip: string; dot: string; rank: number }
> = {
  critical: { label: "Critical", weight: 36, chip: "bg-embermist text-ember", dot: "bg-ember", rank: 0 },
  high: { label: "High", weight: 27, chip: "bg-tangmist text-tang", dot: "bg-tang", rank: 1 },
  medium: { label: "Medium", weight: 16, chip: "bg-steelmist text-steel", dot: "bg-steel", rank: 2 },
  low: { label: "Low", weight: 7, chip: "bg-sagemist text-sage", dot: "bg-sage", rank: 3 },
};

export const STATUS_META: Record<
  Status,
  { label: string; chip: string; dot: string }
> = {
  todo: { label: "To Do", chip: "bg-sagemist text-sage", dot: "bg-sage" },
  inprogress: { label: "In Progress", chip: "bg-pinemist text-pine", dot: "bg-pine" },
  waiting: { label: "Waiting", chip: "bg-ambrmist text-amber", dot: "bg-amber" },
  blocked: { label: "Blocked", chip: "bg-rustmist text-rust", dot: "bg-rust" },
  done: { label: "Done", chip: "bg-donemist text-doneg", dot: "bg-doneg" },
};

export const STATUS_ORDER: Status[] = ["todo", "inprogress", "waiting", "blocked", "done"];

const PROJECT_HUES = [
  "bg-pinemist text-pinedeep",
  "bg-steelmist text-steel",
  "bg-tangmist text-tang",
  "bg-ambrmist text-amber",
  "bg-rustmist text-rust",
  "bg-embermist text-ember",
];

export function projectChip(project: string): string {
  let h = 0;
  for (let i = 0; i < project.length; i++) h = (h * 31 + project.charCodeAt(i)) % 997;
  return PROJECT_HUES[h % PROJECT_HUES.length];
}

export function byIdMap(tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((t) => [t.id, t]));
}

/** Tasks whose completion is required before this task can start */
export function blockedBy(task: Task, byId: Map<string, Task>): Task[] {
  return task.dependsOn
    .map((id) => byId.get(id))
    .filter((t): t is Task => !!t && t.status !== "done");
}

/** Open tasks that depend on the given task */
export function dependentsOf(taskId: string, tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status !== "done" && t.dependsOn.includes(taskId));
}

export function isActionable(task: Task, byId: Map<string, Task>): boolean {
  if (task.status === "done" || task.status === "waiting" || task.status === "blocked") return false;
  return blockedBy(task, byId).length === 0;
}

export interface Scored {
  score: number;
  reasons: string[];
}

/** Priority score 0–100 combining urgency, importance, effort and dependencies */
export function scoreTask(task: Task, tasks: Task[]): Scored {
  if (task.status === "done") return { score: 0, reasons: ["completed"] };
  const byId = byIdMap(tasks);
  const reasons: string[] = [];
  let s = PRIORITY_META[task.priority].weight;
  reasons.push(`${PRIORITY_META[task.priority].label} priority`);

  if (task.dueDate) {
    const diff = daysFromToday(task.dueDate);
    if (diff < 0) {
      s += Math.min(38, 22 + Math.abs(diff) * 4);
      reasons.push(`${Math.abs(diff)}d overdue`);
    } else if (diff === 0) {
      s += 30;
      reasons.push("due today");
    } else if (diff === 1) {
      s += 22;
      reasons.push("due tomorrow");
    } else if (diff <= 3) {
      s += 15;
      reasons.push(`due in ${diff}d`);
    } else if (diff <= 7) {
      s += 9;
    }
  }

  if (task.status === "inprogress") {
    s += 6;
    reasons.push("momentum");
    if (task.inProgressSince) {
      const stuckDays = Math.floor((Date.now() - new Date(task.inProgressSince).getTime()) / 86400000);
      if (stuckDays >= 2) {
        s += 8;
        reasons.push(`stalled ${stuckDays}d`);
      }
    }
  }
  if (task.status === "waiting") s -= 6;
  if (task.status === "blocked") s -= 12;

  const deps = blockedBy(task, byId);
  if (deps.length) {
    s -= 15;
    reasons.push(`blocked by ${deps.length} task${deps.length > 1 ? "s" : ""}`);
  }

  const unlocks = dependentsOf(task.id, tasks).length;
  if (unlocks > 0) {
    s += Math.min(12, 6 + unlocks * 3);
    reasons.push(`unlocks ${unlocks} task${unlocks > 1 ? "s" : ""}`);
  }

  if (task.estimatedMinutes > 0 && task.estimatedMinutes <= 30) {
    s += 4;
    reasons.push("quick win");
  }
  if ((task.priority === "critical" || task.priority === "high") && task.status === "todo" && task.dueDate) {
    const diff = daysFromToday(task.dueDate);
    if (diff >= 0 && diff <= 2) {
      s += 6;
      reasons.push("at-risk start");
    }
  }

  return { score: Math.max(0, Math.min(100, Math.round(s))), reasons };
}

export function rankOpen(tasks: Task[]): { task: Task; score: number; reasons: string[] }[] {
  return tasks
    .filter((t) => t.status !== "done")
    .map((t) => {
      const { score, reasons } = scoreTask(t, tasks);
      return { task: t, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

export function getNextUp(tasks: Task[]) {
  const byId = byIdMap(tasks);
  const ranked = rankOpen(tasks);
  const next = ranked.find((r) => isActionable(r.task, byId));
  return next ?? null;
}

/* ------------------------------- Reminders ------------------------------- */

export function getReminders(tasks: Task[]): Reminder[] {
  const out: Reminder[] = [];
  const now = Date.now();
  const open = tasks.filter((t) => t.status !== "done");

  for (const t of open) {
    if (t.dueDate) {
      const diff = daysFromToday(t.dueDate);
      if (diff < 0) {
        out.push({
          id: `over-${t.id}`, taskId: t.id, severity: diff <= -2 ? "critical" : "high",
          title: `Overdue: ${t.title}`,
          detail: `Was due ${fmtDate(t.dueDate)} (${Math.abs(diff)}d ago) · ${PRIORITY_META[t.priority].label}`,
        });
      } else if (diff === 0) {
        out.push({
          id: `today-${t.id}`, taskId: t.id,
          severity: t.priority === "critical" || t.priority === "high" ? "high" : "medium",
          title: `Due today: ${t.title}`,
          detail: `${PRIORITY_META[t.priority].label} · est ${fmtMinutes(t.estimatedMinutes)}`,
        });
      } else if (diff === 1) {
        out.push({
          id: `tmr-${t.id}`, taskId: t.id, severity: "medium",
          title: `Due tomorrow: ${t.title}`, detail: `${PRIORITY_META[t.priority].label} · est ${fmtMinutes(t.estimatedMinutes)}`,
        });
      }
    }
    if ((t.priority === "critical" || t.priority === "high") && t.status === "todo" && t.dueDate && daysFromToday(t.dueDate) <= 2) {
      out.push({
        id: `unstarted-${t.id}`, taskId: t.id, severity: t.priority === "critical" ? "critical" : "high",
        title: `Not started: ${t.title}`,
        detail: `${PRIORITY_META[t.priority].label} priority, due ${fmtDate(t.dueDate)} and still in To Do`,
      });
    }
    if (t.status === "inprogress" && t.inProgressSince) {
      const days = Math.floor((now - new Date(t.inProgressSince).getTime()) / 86400000);
      if (days >= 3) {
        out.push({
          id: `stale-${t.id}`, taskId: t.id, severity: "high",
          title: `Stalled: ${t.title}`,
          detail: `In progress for ${days} days without completion — consider splitting or re-scoping`,
        });
      }
    }
    if (t.status === "waiting") {
      out.push({
        id: `wait-${t.id}`, taskId: t.id, severity: "low",
        title: `Waiting on others: ${t.title}`,
        detail: t.dueDate ? `Due ${fmtDate(t.dueDate)} — a follow-up nudge may be needed` : "Follow up if it sits too long",
      });
    }
  }

  // Recurring tasks that are due again
  for (const t of tasks) {
    if (t.status === "done" && t.recurrence !== "none" && t.dueDate) {
      const diff = daysFromToday(t.dueDate);
      if (diff <= 0) {
        out.push({
          id: `rec-${t.id}`, taskId: t.id, severity: "medium",
          title: `Recurring due: ${t.title}`, detail: "This routine task is due again — complete it to roll the schedule",
        });
      }
    }
  }

  const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
  return out.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
}

/* -------------------------------- Insights ------------------------------- */

export function buildInsights(tasks: Task[], settings: Settings): Insight[] {
  const out: Insight[] = [];
  const byId = byIdMap(tasks);
  const today = todayISO();
  const next = getNextUp(tasks);
  const open = tasks.filter((t) => t.status !== "done");
  const highPending = open.filter((t) => t.priority === "critical" || t.priority === "high");

  if (next) {
    out.push({
      id: "next", kind: "next",
      title: `Up next: ${next.task.title}`,
      body: `Score ${next.score}/100 — ${next.reasons.slice(0, 3).join(", ")}. Est ${fmtMinutes(next.task.estimatedMinutes)}.`,
      taskId: next.task.id,
      action: { label: "Start focus session", view: "focus" },
    });
  }

  const overdue = open.filter((t) => t.dueDate && daysFromToday(t.dueDate) < 0);
  if (overdue.length) {
    out.push({
      id: "overdue", kind: "warn",
      title: `${overdue.length} task${overdue.length > 1 ? "s" : ""} slipped past ${overdue.length > 1 ? "their" : "its"} deadline`,
      body: overdue.slice(0, 3).map((t) => `“${t.title}” (${Math.abs(daysFromToday(t.dueDate!))}d)`).join(" · ") +
        (overdue.length > 3 ? "…" : "") + ". Clear or reschedule them before stacking new work.",
      taskId: overdue[0].id,
    });
  }

  // Blocking chains
  for (const t of open) {
    const unlocks = dependentsOf(t.id, tasks);
    if (unlocks.length && t.status !== "done") {
      out.push({
        id: `block-${t.id}`, kind: "block",
        title: `“${t.title}” is holding up ${unlocks.length} other task${unlocks.length > 1 ? "s" : ""}`,
        body: `Completing it unblocks: ${unlocks.map((u) => u.title).join(", ")}.`,
        taskId: t.id,
      });
    }
  }

  // Workload realism
  const load = workloadFor(tasks, settings, today);
  if (load.plannedMin > load.capacityMin && load.plannedMin > 0) {
    const over = load.plannedMin - load.capacityMin;
    const deferrable = open
      .filter((t) => isActionable(t, byId) && (!t.dueDate || daysFromToday(t.dueDate) > 1) && (t.plannedFor === today || (t.dueDate === today && t.status === "todo")))
      .sort((a, b) => scoreTask(a, tasks).score - scoreTask(b, tasks).score);
    const candidate = deferrable[0];
    out.push({
      id: "load", kind: "load",
      title: `Today's plan is ${fmtMinutes(over)} over capacity`,
      body: candidate
        ? `Planned ${fmtMinutes(load.plannedMin)} against a ${fmtMinutes(load.capacityMin)} workday. Consider moving “${candidate.title}” to tomorrow.`
        : `Planned ${fmtMinutes(load.plannedMin)} against a ${fmtMinutes(load.capacityMin)} workday. Trim or re-negotiate deadlines.`,
      taskId: candidate?.id,
      action: { label: "Re-plan the day", view: "plan" },
    });
  }

  // Delay risk: big unstarted tasks due soon
  const risky = open.filter(
    (t) => t.status === "todo" && t.dueDate && daysFromToday(t.dueDate) >= 0 && daysFromToday(t.dueDate) <= 2 && t.estimatedMinutes >= 60
  );
  if (risky.length) {
    out.push({
      id: "risk", kind: "risk",
      title: `Likely to slip: ${risky[0].title}`,
      body: `${fmtMinutes(risky[0].estimatedMinutes)} of work due ${daysFromToday(risky[0].dueDate!) === 0 ? "today" : "tomorrow"} and not yet started. Start a slice now or split it into subtasks.`,
      taskId: risky[0].id,
    });
  }

  // Re-prioritization nudge when critical work piles up
  const criticalOpen = highPending.filter((t) => t.priority === "critical");
  if (criticalOpen.length >= 2) {
    out.push({
      id: "repri", kind: "warn",
      title: `${criticalOpen.length} critical tasks are open at once`,
      body: `Only one can be #1. Sequence them: ${criticalOpen.slice(0, 3).map((t) => t.title).join(" → ")}.`,
      taskId: criticalOpen[0].id,
    });
  }

  const doneToday = tasks.filter((t) => t.status === "done" && t.completedAt && toISODate(new Date(t.completedAt)) === today);
  if (doneToday.length >= 3) {
    out.push({
      id: "win", kind: "win",
      title: `Strong pace — ${doneToday.length} tasks completed today`,
      body: `You've logged ${fmtMinutes(doneToday.reduce((a, t) => a + (t.actualMinutes ?? t.estimatedMinutes), 0))} of finished work. Keep the streak, or bank the momentum for tomorrow.`,
    });
  }

  if (out.length === 1 && next) {
    out.push({
      id: "calm", kind: "info",
      title: "Nothing is on fire",
      body: "No overdue, stalled or overloaded signals right now. A good window for deep work on the top-scored task.",
    });
  }

  return out;
}

/* ------------------------------- Workload -------------------------------- */

export interface Workload {
  tasks: Task[];
  plannedMin: number;
  capacityMin: number;
  ratio: number;
}

export function workloadFor(tasks: Task[], settings: Settings, dateISO: string): Workload {
  const byId = byIdMap(tasks);
  const planned = tasks.filter(
    (t) =>
      t.status !== "done" &&
      (t.plannedFor === dateISO || (t.dueDate === dateISO && isActionable(t, byId)))
  );
  const plannedMin = planned.reduce((a, t) => a + t.estimatedMinutes, 0);
  const capacityMin = settings.workdayHours * 60;
  return { tasks: planned, plannedMin, capacityMin, ratio: capacityMin ? plannedMin / capacityMin : 0 };
}

/* ---------------------------- Decomposition ------------------------------ */

export function decomposeSuggestions(task: Task): string[] {
  const title = (task.title + " " + task.description).toLowerCase();
  const sets: [RegExp, string[]][] = [
    [/report|summary|analysis|review doc/, [
      "Collect the raw data and sources", "Draft the outline and key headings",
      "Build charts / supporting figures", "Write the first full draft",
      "Self-review and tighten the narrative", "Send for feedback or publish",
    ]],
    [/presentation|deck|slides|pitch/, [
      "Define the 3 key messages", "Sketch the slide outline",
      "Draft the visuals and charts", "Write speaker notes", "Rehearse once end-to-end",
    ]],
    [/invoice|expense|reconcil|budget|payment/, [
      "Gather all receipts and line items", "Enter items into the sheet / tool",
      "Cross-check totals against statements", "Flag discrepancies", "Submit for approval",
    ]],
    [/migrat|install|setup|set up|configur|deploy/, [
      "Back up the current state", "Document current configuration",
      "Run the migration in a test pass", "Verify everything works", "Switch over and monitor",
    ]],
    [/contract|renewal|agreement|legal/, [
      "Pull the current agreement and terms", "List the clauses that need changes",
      "Draft the redline version", "Circulate for internal review", "Send for signature",
    ]],
    [/onboard|training|hire/, [
      "Prepare the checklist and accounts", "Schedule intro sessions",
      "Pair on a first small task", "Collect feedback after week one",
    ]],
    [/email|client|reply|ticket/, [
      "Read and extract every ask", "Answer the quick points first",
      "Draft the longer response", "Re-read and send",
    ]],
  ];
  for (const [re, steps] of sets) if (re.test(title)) return steps;
  return [
    "Clarify the definition of done",
    "Gather everything needed to start",
    "Do the first 25-minute slice",
    "Review against the definition of done",
    "Wrap up and communicate the outcome",
  ];
}

/* ------------------------------- Summaries ------------------------------- */

export function endOfDaySummary(tasks: Task[], activity: ActivityEvent[]): string[] {
  const today = todayISO();
  const doneToday = tasks.filter((t) => t.completedAt && toISODate(new Date(t.completedAt)) === today);
  const mins = doneToday.reduce((a, t) => a + (t.actualMinutes ?? t.estimatedMinutes), 0);
  const inProg = tasks.filter((t) => t.status === "inprogress");
  const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate && daysFromToday(t.dueDate) < 0);
  const carry = tasks.filter((t) => t.plannedFor === today && t.status !== "done");
  const statusChanges = activity.filter((a) => a.kind === "status" && toISODate(new Date(a.at)) === today).length;

  const lines: string[] = [];
  lines.push(
    doneToday.length
      ? `You completed ${doneToday.length} task${doneToday.length > 1 ? "s" : ""} today, worth ~${fmtMinutes(mins)} of focused work.`
      : "No tasks were completed today — tomorrow is a fresh start."
  );
  if (inProg.length) lines.push(`${inProg.length} task${inProg.length > 1 ? "s are" : " is"} mid-flight: ${inProg.slice(0, 2).map((t) => `“${t.title}”`).join(", ")}${inProg.length > 2 ? "…" : ""}.`);
  if (carry.length) lines.push(`${carry.length} planned item${carry.length > 1 ? "s" : ""} didn't finish — carry ${carry.length > 1 ? "them" : "it"} forward deliberately, not by default.`);
  if (overdue.length) lines.push(`⚠ ${overdue.length} task${overdue.length > 1 ? "s are" : " is"} now overdue. Decide first thing tomorrow: do, delegate or re-date.`);
  lines.push(`${statusChanges} status update${statusChanges === 1 ? "" : "s"} logged today — the record is current.`);
  return lines;
}

export function weeklyStats(tasks: Task[]) {
  const days = lastNDays(14);
  const perDay = days.map((d) => ({
    date: d,
    completed: tasks.filter((t) => t.completedAt && toISODate(new Date(t.completedAt)) === d).length,
    minutes: tasks
      .filter((t) => t.completedAt && toISODate(new Date(t.completedAt)) === d)
      .reduce((a, t) => a + (t.actualMinutes ?? t.estimatedMinutes), 0),
  }));
  const open = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const withActual = done.filter((t) => t.actualMinutes != null);
  const avgActual = withActual.length
    ? Math.round(withActual.reduce((a, t) => a + (t.actualMinutes ?? 0), 0) / withActual.length)
    : 0;
  const avgEst = withActual.length
    ? Math.round(withActual.reduce((a, t) => a + t.estimatedMinutes, 0) / withActual.length)
    : 0;
  return { perDay, open: open.length, done: done.length, avgActual, avgEst };
}

export function projectTime(tasks: Task[]) {
  const map = new Map<string, { est: number; actual: number; count: number }>();
  for (const t of tasks) {
    if (t.status !== "done") continue;
    const cur = map.get(t.project) ?? { est: 0, actual: 0, count: 0 };
    cur.est += t.estimatedMinutes;
    cur.actual += t.actualMinutes ?? t.estimatedMinutes;
    cur.count += 1;
    map.set(t.project, cur);
  }
  return [...map.entries()]
    .map(([project, v]) => ({ project, ...v }))
    .sort((a, b) => b.actual - a.actual);
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
