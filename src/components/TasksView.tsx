import { useMemo, useState } from "react";
import { ListTodo, Search, SlidersHorizontal, X } from "lucide-react";
import type { Priority, Status, Task } from "../types";
import { useStore } from "../store";
import { PRIORITY_META, STATUS_META, STATUS_ORDER, scoreTask } from "../lib/engine";
import { addDaysISO, todayISO } from "../lib/dates";
import { EmptyState, PriorityBadge, selectCls } from "./ui";
import TaskRow from "./TaskRow";

type DuePreset = "any" | "overdue" | "today" | "week" | "nodate";
type CreatedPreset = "any" | "today" | "week" | "month";
type SortKey = "score" | "due" | "priority" | "created" | "updated" | "estimate";

interface Props {
  onOpenTask: (id: string) => void;
  query: string;
  setQuery: (q: string) => void;
}

export default function TasksView({ onOpenTask, query, setQuery }: Props) {
  const { state } = useStore();
  const [statuses, setStatuses] = useState<Set<Status>>(new Set());
  const [priorities, setPriorities] = useState<Set<Priority>>(new Set());
  const [project, setProject] = useState("");
  const [duePreset, setDuePreset] = useState<DuePreset>("any");
  const [createdPreset, setCreatedPreset] = useState<CreatedPreset>("any");
  const [sort, setSort] = useState<SortKey>("score");
  const [showFilters, setShowFilters] = useState(false);

  const today = todayISO();
  const weekEnd = addDaysISO(today, 7);
  const monthAgo = addDaysISO(today, -30);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = state.tasks.filter((t) => {
      if (q) {
        const hay = `${t.title} ${t.description} ${t.notes} ${t.project} ${t.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statuses.size && !statuses.has(t.status)) return false;
      if (priorities.size && !priorities.has(t.priority)) return false;
      if (project && t.project !== project) return false;
      if (duePreset === "overdue" && !(t.dueDate && t.dueDate < today && t.status !== "done")) return false;
      if (duePreset === "today" && t.dueDate !== today) return false;
      if (duePreset === "week" && !(t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd)) return false;
      if (duePreset === "nodate" && t.dueDate) return false;
      if (createdPreset === "today" && t.createdAt.slice(0, 10) !== today) return false;
      if (createdPreset === "week" && t.createdAt.slice(0, 10) < addDaysISO(today, -7)) return false;
      if (createdPreset === "month" && t.createdAt.slice(0, 10) < monthAgo) return false;
      return true;
    });
    const withScore = list.map((t) => ({ t, s: scoreTask(t, state.tasks).score }));
    withScore.sort((a, b) => {
      switch (sort) {
        case "score": return b.s - a.s;
        case "due": return (a.t.dueDate ?? "9999").localeCompare(b.t.dueDate ?? "9999");
        case "priority": return PRIORITY_META[a.t.priority].rank - PRIORITY_META[b.t.priority].rank || b.s - a.s;
        case "created": return b.t.createdAt.localeCompare(a.t.createdAt);
        case "updated": return b.t.updatedAt.localeCompare(a.t.updatedAt);
        case "estimate": return a.t.estimatedMinutes - b.t.estimatedMinutes;
      }
    });
    return withScore.map((x) => x.t);
  }, [state.tasks, query, statuses, priorities, project, duePreset, createdPreset, sort, today, weekEnd, monthAgo]);

  const activeFilters = statuses.size + priorities.size + (project ? 1 : 0) + (duePreset !== "any" ? 1 : 0) + (createdPreset !== "any" ? 1 : 0);

  const clearAll = () => {
    setStatuses(new Set()); setPriorities(new Set()); setProject(""); setDuePreset("any"); setCreatedPreset("any"); setQuery("");
  };

  const toggle = <T,>(set: Set<T>, v: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v); else next.add(v);
    apply(next);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-inkfaint" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, description, tags, project…"
            className="w-full rounded-lg border border-line bg-card py-2 pl-9 pr-8 text-[13px] outline-none transition-all placeholder:text-inkfaint focus:border-pine focus:ring-2 focus:ring-pine/15"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-inkfaint hover:text-ink" aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>
        <button onClick={() => setShowFilters((f) => !f)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium transition-all active:scale-95
            ${showFilters || activeFilters ? "border-pine bg-pinemist text-pinedeep" : "border-line bg-card text-inksoft hover:border-pine/50"}`}>
          <SlidersHorizontal size={13} /> Filters
          {activeFilters > 0 && <span className="rounded-full bg-pine px-1.5 font-mono text-[10px] font-bold text-white">{activeFilters}</span>}
        </button>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={selectCls}>
          <option value="score">Sort · priority score</option>
          <option value="due">Sort · due date</option>
          <option value="priority">Sort · priority</option>
          <option value="created">Sort · newest</option>
          <option value="updated">Sort · recently updated</option>
          <option value="estimate">Sort · shortest effort</option>
        </select>
      </div>

      {showFilters && (
        <div className="anim-pop mb-4 rounded-xl border border-line bg-card p-3.5 shadow-sm">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Status</p>
              <div className="flex flex-wrap gap-1">
                {STATUS_ORDER.map((s) => (
                  <button key={s} onClick={() => toggle(statuses, s, setStatuses)}
                    className={`rounded-md px-2 py-1 text-[11.5px] font-medium transition-all active:scale-95
                      ${statuses.has(s) ? `${STATUS_META[s].chip} ring-1 ring-current/30` : "bg-mist text-inksoft hover:bg-linesoft"}`}>
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Priority</p>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(PRIORITY_META) as Priority[]).map((p) => (
                  <button key={p} onClick={() => toggle(priorities, p, setPriorities)}
                    className={`rounded-md px-2 py-1 text-[11.5px] font-medium transition-all active:scale-95
                      ${priorities.has(p) ? `${PRIORITY_META[p].chip} ring-1 ring-current/30` : "bg-mist text-inksoft hover:bg-linesoft"}`}>
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Project</p>
              <select value={project} onChange={(e) => setProject(e.target.value)} className={selectCls}>
                <option value="">All projects</option>
                {[...new Set(state.tasks.map((t) => t.project))].sort().map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Due</p>
              <select value={duePreset} onChange={(e) => setDuePreset(e.target.value as DuePreset)} className={selectCls}>
                <option value="any">Any time</option>
                <option value="overdue">Overdue</option>
                <option value="today">Due today</option>
                <option value="week">Next 7 days</option>
                <option value="nodate">No due date</option>
              </select>
            </div>
            <div>
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Created</p>
              <select value={createdPreset} onChange={(e) => setCreatedPreset(e.target.value as CreatedPreset)} className={selectCls}>
                <option value="any">All time</option>
                <option value="today">Today</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
              </select>
            </div>
          </div>
          {activeFilters > 0 && (
            <button onClick={clearAll} className="mt-3 text-[11.5px] font-semibold text-ember transition-colors hover:text-ink">
              Clear all filters
            </button>
          )}
        </div>
      )}

      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-inkfaint">
        {filtered.length} task{filtered.length !== 1 && "s"}
        {query && <> matching “{query}”</>}
      </p>

      {filtered.length ? (
        <div className="space-y-1">
          {filtered.map((t, i) => (
            <TaskRow key={t.id} task={t} all={state.tasks} onOpen={onOpenTask} delay={Math.min(i, 12) * 25} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<ListTodo size={26} />} title="No tasks match"
          hint="Loosen the filters or capture something new — nothing here fits the current search."
          action={activeFilters || query ? (
            <button onClick={clearAll} className="mt-1 rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-semibold text-inksoft hover:border-pine hover:text-pine">
              Clear filters
            </button>
          ) : undefined} />
      )}
    </div>
  );
}
