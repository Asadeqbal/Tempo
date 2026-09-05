export type Priority = "critical" | "high" | "medium" | "low";
export type Status = "todo" | "inprogress" | "waiting" | "blocked" | "done";
export type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface LinkItem {
  id: string;
  label: string;
  url: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  project: string;
  priority: Priority;
  status: Status;
  dueDate: string | null; // YYYY-MM-DD
  estimatedMinutes: number;
  actualMinutes: number | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  completedAt: string | null; // ISO
  inProgressSince: string | null; // ISO
  tags: string[];
  notes: string;
  links: LinkItem[];
  dependsOn: string[]; // task ids that must complete first
  recurrence: Recurrence;
  subtasks: Subtask[];
  plannedFor: string | null; // YYYY-MM-DD — the day this task is planned on
}

export type ActivityKind =
  | "created"
  | "status"
  | "priority"
  | "edit"
  | "note"
  | "completed"
  | "reopened"
  | "duplicated"
  | "recurrence"
  | "subtask"
  | "planned"
  | "decomposed";

export interface ActivityEvent {
  id: string;
  taskId: string;
  at: string; // ISO
  kind: ActivityKind;
  text: string;
}

export interface Settings {
  workdayHours: number;
  userName: string;
}

export interface AppState {
  tasks: Task[];
  activity: ActivityEvent[];
  settings: Settings;
  seededAt: string;
}

export type Severity = "critical" | "high" | "medium" | "low";

export interface Reminder {
  id: string;
  taskId: string | null;
  severity: Severity;
  title: string;
  detail: string;
}

export interface Insight {
  id: string;
  kind: "next" | "warn" | "risk" | "block" | "load" | "win" | "info";
  title: string;
  body: string;
  taskId?: string;
  action?: { label: string; view: string };
}

export type ViewName =
  | "dashboard"
  | "board"
  | "tasks"
  | "plan"
  | "focus"
  | "reports";
