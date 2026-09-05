import { Clock3, Repeat } from "lucide-react";
import type { Task } from "../types";
import { useStore, useToasts } from "../store";
import { DueChip, PriorityBadge, ProjectChip, ScoreMeter, TagChip, TaskCheck } from "./ui";
import { scoreTask } from "../lib/engine";
import { fmtMinutes, relativeFrom } from "../lib/dates";

interface Props {
  task: Task;
  all: Task[];
  onOpen: (id: string) => void;
  showProject?: boolean;
  showScore?: boolean;
  delay?: number;
}

export default function TaskRow({ task, all, onOpen, showProject = true, showScore = true, delay = 0 }: Props) {
  const { completeTask, reopenTask } = useStore();
  const { push } = useToasts();
  const done = task.status === "done";
  const { score } = scoreTask(task, all);

  return (
    <div
      onClick={() => onOpen(task.id)}
      className="anim-rise group flex cursor-pointer items-center gap-3 rounded-lg border border-transparent bg-card px-3 py-2.5 transition-all duration-200 hover:-translate-y-px hover:border-line hover:shadow-md hover:shadow-ink/5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <TaskCheck done={done} onToggle={() => {
        if (done) { reopenTask(task.id); push("info", "Task reopened", task.title); }
        else { completeTask(task.id); push("success", "Task completed", task.title); }
      }} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13.5px] font-medium leading-snug ${done ? "text-inkfaint line-through decoration-doneg/50" : "text-ink"}`}>
          {task.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {showProject && <ProjectChip name={task.project} />}
          <DueChip due={task.dueDate} done={done} />
          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] text-inkfaint">
            <Clock3 size={10} /> {fmtMinutes(task.estimatedMinutes)}
            {task.actualMinutes != null && done && <span className="text-doneg">/{fmtMinutes(task.actualMinutes)}</span>}
          </span>
          {task.recurrence !== "none" && (
            <span className="inline-flex items-center gap-0.5 font-mono text-[10.5px] text-pine"><Repeat size={10} />{task.recurrence}</span>
          )}
          {task.subtasks.length > 0 && (
            <span className="font-mono text-[10.5px] text-inkfaint">
              ▤ {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
            </span>
          )}
          <span className="hidden gap-1 sm:flex">
            {task.tags.slice(0, 2).map((t) => <TagChip key={t} tag={t} />)}
          </span>
        </div>
      </div>
      <div className="hidden items-center gap-2.5 sm:flex">
        <PriorityBadge p={task.priority} />
        {showScore && !done && <ScoreMeter score={score} />}
      </div>
      <span className="hidden w-16 shrink-0 text-right font-mono text-[10.5px] text-inkfaint lg:block">
        {done && task.completedAt ? relativeFrom(task.completedAt) : relativeFrom(task.updatedAt)}
      </span>
    </div>
  );
}
