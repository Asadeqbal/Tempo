import type { ActivityEvent, AppState, Task } from "../types";
import { addDaysISO, todayISO } from "../lib/dates";

const T = todayISO();
const d = (offset: number) => addDaysISO(T, offset);
const ago = (hours: number) => new Date(Date.now() - hours * 3600_000).toISOString();

let n = 0;
const ev = (taskId: string, at: string, kind: ActivityEvent["kind"], text: string): ActivityEvent => ({
  id: `a${++n}`, taskId, at, kind, text,
});

export function buildSeed(): AppState {
  const mk = (t: Partial<Task> & Pick<Task, "id" | "title" | "project" | "priority" | "status">): Task => ({
    description: "",
    dueDate: null,
    estimatedMinutes: 30,
    actualMinutes: null,
    createdAt: ago(48),
    updatedAt: ago(5),
    completedAt: null,
    inProgressSince: null,
    tags: [],
    notes: "",
    links: [],
    dependsOn: [],
    recurrence: "none",
    subtasks: [],
    plannedFor: null,
    ...t,
  });

  const tasks: Task[] = [
    mk({
      id: "t-inv", title: "Send Q3 invoice to Meridian", project: "Finance", priority: "critical", status: "todo",
      dueDate: d(-1), estimatedMinutes: 20, createdAt: ago(70), tags: ["invoice", "meridian"],
      description: "Invoice #204 for the retainer plus the September overage hours.",
      notes: "Overage sheet is in the Finance folder. Double-check the hourly total before sending.",
    }),
    mk({
      id: "t-exp", title: "Prepare monthly expense report", project: "Finance", priority: "high", status: "inprogress",
      dueDate: d(0), estimatedMinutes: 90, createdAt: ago(50), inProgressSince: ago(3), plannedFor: T,
      dependsOn: ["t-rec"], tags: ["report"],
      description: "Compile September expenses for the management summary.",
      subtasks: [
        { id: "s1", title: "Gather receipts", done: true },
        { id: "s2", title: "Categorize line items", done: true },
        { id: "s3", title: "Build summary sheet", done: false },
      ],
      notes: "Travel category looks high — add a one-line explanation.",
    }),
    mk({
      id: "t-rec", title: "Collect September receipts", project: "Finance", priority: "medium", status: "done",
      dueDate: d(0), estimatedMinutes: 30, actualMinutes: 35, createdAt: ago(50),
      completedAt: ago(2), updatedAt: ago(2), tags: ["report"],
    }),
    mk({
      id: "t-ren", title: "Draft contract renewal for Meridian", project: "Client Work", priority: "high", status: "todo",
      dueDate: d(2), estimatedMinutes: 120, createdAt: ago(30), dependsOn: ["t-price"], tags: ["contract"],
      description: "Renewal for the annual service agreement — incorporate the updated vendor pricing.",
    }),
    mk({
      id: "t-price", title: "Get updated pricing from vendors", project: "Client Work", priority: "medium", status: "waiting",
      dueDate: d(1), estimatedMinutes: 30, createdAt: ago(55), tags: ["vendor"],
      notes: "Waiting on replies from two vendors. Sent chase emails yesterday.",
    }),
    mk({
      id: "t-tix", title: "Reply to Meridian support ticket #482", project: "Client Work", priority: "high", status: "todo",
      dueDate: d(0), estimatedMinutes: 15, createdAt: ago(8), plannedFor: T, tags: ["support"],
      description: "Login loop on the staging portal — likely the session cookie fix from last sprint.",
    }),
    mk({
      id: "t-ops", title: "Weekly ops checklist", project: "Operations", priority: "medium", status: "todo",
      dueDate: d(0), estimatedMinutes: 40, createdAt: ago(96), plannedFor: T, recurrence: "weekly", tags: ["routine"],
      description: "Inbox triage, update the ops board, reconcile the petty-cash box, check supplies.",
    }),
    mk({
      id: "t-stand", title: "Daily standup notes", project: "Team", priority: "low", status: "done",
      dueDate: d(-1), estimatedMinutes: 10, actualMinutes: 10, createdAt: ago(120),
      completedAt: ago(26), updatedAt: ago(26), recurrence: "daily", tags: ["routine"],
    }),
    mk({
      id: "t-stand2", title: "Daily standup notes", project: "Team", priority: "low", status: "todo",
      dueDate: d(0), estimatedMinutes: 10, createdAt: ago(26), recurrence: "daily", tags: ["routine"],
    }),
    mk({
      id: "t-avail", title: "Update team availability sheet", project: "Team", priority: "low", status: "todo",
      dueDate: d(3), estimatedMinutes: 10, createdAt: ago(20),
    }),
    mk({
      id: "t-mig", title: "Migrate email to new client", project: "IT & Tools", priority: "high", status: "blocked",
      dueDate: d(4), estimatedMinutes: 60, createdAt: ago(80), dependsOn: ["t-lic"], tags: ["it"],
      description: "Move the shared mailbox over once the license is active.",
      notes: "Blocked on the license purchase — vendor quote already approved.",
    }),
    mk({
      id: "t-lic", title: "Purchase license for email client", project: "IT & Tools", priority: "medium", status: "todo",
      dueDate: d(2), estimatedMinutes: 15, createdAt: ago(80), tags: ["it", "purchase"],
    }),
    mk({
      id: "t-fly", title: "Book flights for October site visit", project: "Operations", priority: "medium", status: "todo",
      dueDate: d(5), estimatedMinutes: 25, createdAt: ago(40), tags: ["travel"],
    }),
    mk({
      id: "t-retro", title: "Write project retro summary", project: "Team", priority: "medium", status: "inprogress",
      dueDate: d(1), estimatedMinutes: 45, createdAt: ago(140), inProgressSince: ago(96), tags: ["retro"],
      description: "Summarize the Phoenix project retro into one page of actions.",
      notes: "Kept getting interrupted — maybe timebox 25 minutes and ship a v1.",
    }),
    mk({
      id: "t-onb", title: "Review new hire onboarding docs", project: "Team", priority: "high", status: "todo",
      dueDate: d(1), estimatedMinutes: 50, createdAt: ago(28), tags: ["hiring"],
    }),
    mk({
      id: "t-bak", title: "Refactor backup scripts", project: "IT & Tools", priority: "low", status: "todo",
      dueDate: null, estimatedMinutes: 120, createdAt: ago(200), tags: ["deepwork"],
      description: "Split the nightly backup script into per-service jobs with retries.",
    }),
    mk({
      id: "t-deck", title: "Client presentation deck — Q4 roadmap", project: "Client Work", priority: "critical", status: "inprogress",
      dueDate: d(1), estimatedMinutes: 180, createdAt: ago(36), inProgressSince: ago(1.5), plannedFor: T, tags: ["deck", "meridian"],
      description: "12–15 slides covering Q4 roadmap, risks and the ask for next quarter.",
      subtasks: [
        { id: "d1", title: "Outline the narrative arc", done: true },
        { id: "d2", title: "Pull metrics from the dashboard", done: true },
        { id: "d3", title: "Design the roadmap slide", done: false },
        { id: "d4", title: "Write speaker notes", done: false },
        { id: "d5", title: "Dry run end-to-end", done: false },
      ],
      links: [{ id: "l1", label: "Draft in Drive", url: "https://drive.example.com/q4-deck" }],
    }),
    mk({
      id: "t-bank", title: "Reconcile bank statements", project: "Finance", priority: "medium", status: "done",
      dueDate: d(-1), estimatedMinutes: 30, actualMinutes: 40, createdAt: ago(60),
      completedAt: new Date(parseD(d(-1)) + 15 * 3600_000).toISOString(), updatedAt: new Date(parseD(d(-1)) + 15 * 3600_000).toISOString(),
    }),
    mk({
      id: "t-time", title: "Submit timesheet", project: "Operations", priority: "low", status: "done",
      dueDate: d(-2), estimatedMinutes: 10, actualMinutes: 8, createdAt: ago(100),
      completedAt: new Date(parseD(d(-2)) + 11 * 3600_000).toISOString(), updatedAt: new Date(parseD(d(-2)) + 11 * 3600_000).toISOString(),
      recurrence: "weekly",
    }),
    mk({
      id: "t-sec", title: "Quarterly security review", project: "IT & Tools", priority: "high", status: "todo",
      dueDate: d(7), estimatedMinutes: 240, createdAt: ago(160), tags: ["security"],
      description: "Access inventory, permission audit and patch status across all tools.",
      subtasks: [
        { id: "q1", title: "Inventory all active accounts", done: true },
        { id: "q2", title: "Audit admin permissions", done: false },
        { id: "q3", title: "Check patch levels", done: false },
      ],
    }),
    mk({
      id: "t-dom", title: "Renew domain names", project: "IT & Tools", priority: "medium", status: "todo",
      dueDate: d(6), estimatedMinutes: 20, createdAt: ago(70), tags: ["infra"],
    }),
    mk({
      id: "t-plan", title: "Plan November team offsite agenda", project: "Team", priority: "medium", status: "todo",
      dueDate: d(9), estimatedMinutes: 60, createdAt: ago(15), plannedFor: T, tags: ["offsite"],
    }),
    mk({
      id: "t-form", title: "Update vendor contact form", project: "Client Work", priority: "medium", status: "done",
      dueDate: d(-3), estimatedMinutes: 20, actualMinutes: 25, createdAt: ago(150),
      completedAt: new Date(parseD(d(-3)) + 13 * 3600_000).toISOString(), updatedAt: new Date(parseD(d(-3)) + 13 * 3600_000).toISOString(),
    }),
    mk({
      id: "t-clean", title: "Clean up shared drive folders", project: "Operations", priority: "low", status: "done",
      dueDate: d(-4), estimatedMinutes: 45, actualMinutes: 50, createdAt: ago(220),
      completedAt: new Date(parseD(d(-4)) + 16 * 3600_000).toISOString(), updatedAt: new Date(parseD(d(-4)) + 16 * 3600_000).toISOString(),
    }),
  ];

  const activity: ActivityEvent[] = [];
  for (const t of tasks) {
    activity.push(ev(t.id, t.createdAt, "created", `Task created in ${t.project}`));
    if (t.status === "inprogress") activity.push(ev(t.id, t.inProgressSince ?? t.createdAt, "status", "Status → In Progress"));
    if (t.status === "waiting") activity.push(ev(t.id, ago(30), "status", "Status → Waiting (on vendors)"));
    if (t.status === "blocked") activity.push(ev(t.id, ago(40), "status", "Status → Blocked (license purchase)"));
    if (t.status === "done") activity.push(ev(t.id, t.completedAt!, "completed", `Completed in ${t.actualMinutes}m (est ${t.estimatedMinutes}m)`));
  }
  activity.push(ev("t-exp", ago(30), "subtask", "Subtask done: Categorize line items"));
  activity.push(ev("t-deck", ago(20), "subtask", "Subtask done: Pull metrics from the dashboard"));
  activity.push(ev("t-rec", ago(2), "recurrence", "Recurring task — next occurrence scheduled"));
  activity.sort((a, b) => b.at.localeCompare(a.at));

  return { tasks, activity, settings: { workdayHours: 8, userName: "Alex" }, seededAt: new Date().toISOString() };
}

function parseD(iso: string): number {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day, 9).getTime();
}
