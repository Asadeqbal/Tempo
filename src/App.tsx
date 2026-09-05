import { useEffect, useMemo, useState } from "react";
import {
  BarChart3, Bell, CalendarDays, Columns, Download, KeyRound, LayoutDashboard,
  ListTodo, Loader2, LogOut, Plus, RefreshCcw, Search, ShieldCheck, Target, Zap,
} from "lucide-react";
import type { Status, ViewName } from "./types";
import { StoreProvider, ToastProvider, buildFreshState, useStore, useToasts, useNow } from "./store";
import { getReminders } from "./lib/engine";
import { AuthProvider, useAuth } from "./lib/auth";
import AuthScreen from "./components/AuthScreen";
import ChangePasswordModal from "./components/ChangePasswordModal";
import { TempoLogo } from "./components/Logo";

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-ember", high: "bg-tang", medium: "bg-amber", low: "bg-sage",
};
import Dashboard from "./components/Dashboard";
import Board from "./components/Board";
import TasksView from "./components/TasksView";
import PlanDay from "./components/PlanDay";
import FocusMode from "./components/FocusMode";
import Reports from "./components/Reports";
import TaskModal from "./components/TaskModal";
import TaskDrawer from "./components/TaskDrawer";
import QuickCapture from "./components/QuickCapture";
import { Kbd } from "./components/ui";
import { fmtDateLong, todayISO } from "./lib/dates";

const VIEWS: { id: ViewName; label: string; title: string; sub: string }[] = [
  { id: "dashboard", label: "Dashboard", title: "Cockpit", sub: "Signals, priorities and today's shape" },
  { id: "board", label: "Board", title: "Kanban board", sub: "Drag work across its lifecycle" },
  { id: "tasks", label: "Tasks", title: "All tasks", sub: "Search, filter and triage everything" },
  { id: "plan", label: "Plan day", title: "Plan my day", sub: "Commit to a realistic workload" },
  { id: "focus", label: "Focus", title: "Focus mode", sub: "One task, one timer, zero noise" },
  { id: "reports", label: "Reports", title: "Reports", sub: "Productivity, trends and weekly review" },
];

function Shell() {
  const { state, resetAll, exportJSON, setPlannedFor } = useStore();
  const { push } = useToasts();
  const { user, logout } = useAuth();
  const now = useNow(1000);

  const [view, setView] = useState<ViewName>("dashboard");
  const [modal, setModal] = useState<{ open: boolean; taskId?: string | null; defaults?: { status?: Status } }>({ open: false });
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [focus, setFocus] = useState<{ open: boolean; taskId: string | null }>({ open: false, taskId: null });
  const [query, setQuery] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const userInitials = (user?.name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  const reminders = useMemo(() => getReminders(state.tasks), [state.tasks]);
  const criticalCount = reminders.filter((r) => r.severity === "critical").length;
  const openCount = state.tasks.filter((t) => t.status !== "done").length;
  const plannedCount = state.tasks.filter((t) => t.plannedFor === todayISO() && t.status !== "done").length;
  const weekDone = state.tasks.filter((t) => t.completedAt && t.completedAt >= new Date(Date.now() - 7 * 86400000).toISOString()).length;

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCaptureOpen(true);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "n") { e.preventDefault(); setModal({ open: true, taskId: null }); }
      else if (k === "f") { e.preventDefault(); setFocus({ open: true, taskId: null }); }
      else if (k === "c") { e.preventDefault(); setCaptureOpen(true); }
      else if (["1", "2", "3", "4", "5", "6"].includes(k)) {
        setView(VIEWS[parseInt(k, 10) - 1].id);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const counts: Partial<Record<ViewName, number>> = {
    board: openCount, tasks: openCount, plan: plannedCount, reports: weekDone, dashboard: reminders.length,
  };

  const active = VIEWS.find((v) => v.id === view)!;

  const handlePlanToggle = (id: string) => {
    const t = state.tasks.find((x) => x.id === id);
    const today = todayISO();
    if (t?.plannedFor === today) {
      setPlannedFor(id, null);
      push("info", "Removed from today's plan", t.title);
    } else {
      setPlannedFor(id, today);
      push("success", "Planned for today", t?.title);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <aside className="night-texture flex w-14 shrink-0 flex-col border-r border-nightline md:w-[212px]">
        <div className="flex items-center gap-2.5 px-3 py-4 md:px-4">
          <TempoLogo size={34} light />
          <div className="hidden md:block">
            <p className="font-display text-[17px] font-bold leading-none tracking-tight text-white">Tempo</p>
            <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-nighttext/60">work cockpit</p>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-0.5 px-2 md:px-2.5">
          {VIEWS.map((v, i) => {
            const isActive = view === v.id;
            return (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-all duration-150
                  ${isActive ? "bg-night2 text-white" : "text-nighttext/75 hover:bg-night2/60 hover:text-white"}`}
                title={`${v.label} (${i + 1})`}>
                {isActive && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-mint" />}
                <span className={`shrink-0 ${isActive ? "text-mint" : ""}`}>
                  {v.id === "dashboard" && <LayoutDashboard size={16} />}
                  {v.id === "board" && <Columns size={16} />}
                  {v.id === "tasks" && <ListTodo size={16} />}
                  {v.id === "plan" && <CalendarDays size={16} />}
                  {v.id === "focus" && <Target size={16} />}
                  {v.id === "reports" && <BarChart3 size={16} />}
                </span>
                <span className="hidden flex-1 md:block">{v.label}</span>
                {counts[v.id] != null && counts[v.id]! > 0 && (
                  <span className={`hidden rounded-full px-1.5 py-px font-mono text-[10px] font-semibold md:block
                    ${v.id === "dashboard" && criticalCount ? "bg-ember/25 text-[#f0a48f]" : "bg-nightline text-nighttext"}`}>
                    {counts[v.id]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-nightline px-2 py-3 md:px-2.5">
          {/* Signed-in profile */}
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-night2/70 px-2.5 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine font-mono text-[10px] font-bold text-white ring-2 ring-mint/25">
              {userInitials}
            </span>
            <div className="hidden min-w-0 flex-1 md:block">
              <p className="truncate text-[12px] font-semibold leading-tight text-white">{user?.name}</p>
              <p className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] text-mint/70">
                <ShieldCheck size={9} /> encrypted vault
              </p>
            </div>
            <div className="ml-auto flex items-center gap-0.5">
              <button onClick={() => setPwModal(true)} title="Change password"
                className="rounded-md p-1.5 text-nighttext/70 transition-colors hover:bg-night/60 hover:text-mint">
                <KeyRound size={13} />
              </button>
              <button
                onClick={() => {
                  if (!confirmLogout) { setConfirmLogout(true); window.setTimeout(() => setConfirmLogout(false), 2200); return; }
                  setConfirmLogout(false);
                  push("info", "Workspace locked", "Sign in again to reopen your tasks.");
                  logout();
                }}
                title={confirmLogout ? "Click again to lock" : "Lock & sign out"}
                className={`rounded-md p-1.5 transition-colors ${confirmLogout ? "bg-ember/25 text-[#f0a48f]" : "text-nighttext/70 hover:bg-night/60 hover:text-[#f0a48f]"}`}>
                <LogOut size={13} />
              </button>
            </div>
          </div>

          <div className="mb-2 hidden items-center gap-2 rounded-lg bg-night2/70 px-2.5 py-2 md:flex">
            <Zap size={13} className="shrink-0 text-mint" />
            <p className="font-mono text-[10.5px] leading-snug text-nighttext">
              {state.settings.workdayHours}h workday ·<br />local-first data
            </p>
          </div>
          <button onClick={() => { exportJSON(); push("success", "Backup exported", "Unencrypted JSON snapshot downloaded"); }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium text-nighttext/75 transition-colors hover:bg-night2/60 hover:text-white"
            title="Export backup">
            <Download size={15} /> <span className="hidden md:block">Export backup</span>
          </button>
          <button
            onClick={() => {
              if (!confirmReset) { setConfirmReset(true); window.setTimeout(() => setConfirmReset(false), 2600); return; }
              resetAll(); setConfirmReset(false);
              push("info", "Workspace reset", "All tasks in this profile were cleared");
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors
              ${confirmReset ? "bg-ember/20 text-[#f0a48f]" : "text-nighttext/75 hover:bg-night2/60 hover:text-white"}`}
            title="Reset workspace data">
            <RefreshCcw size={15} /> <span className="hidden md:block">{confirmReset ? "Click to confirm" : "Reset workspace"}</span>
          </button>
          <div className="hidden pt-1 md:block">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 px-2.5 font-mono text-[9.5px] text-nighttext/50">
              <Kbd dark>⌘K</Kbd> capture · <Kbd dark>N</Kbd> new · <Kbd dark>F</Kbd> focus
            </p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="app-wash dotfield flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex items-center gap-3 border-b border-line bg-card/70 px-4 py-3 backdrop-blur-sm md:px-6">
          <div className="min-w-0">
            <h1 className="font-display text-[17px] font-bold leading-tight text-ink md:text-[19px]">{active.title}</h1>
            <p className="hidden truncate font-mono text-[10.5px] text-inkfaint sm:block">{active.sub}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-inkfaint" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); if (view !== "tasks") setView("tasks"); }}
                placeholder="Search tasks…"
                className="w-44 rounded-lg border border-line bg-paper py-1.5 pl-8 pr-3 text-[12.5px] outline-none transition-all placeholder:text-inkfaint focus:w-60 focus:border-pine focus:ring-2 focus:ring-pine/15"
              />
            </div>

            {/* Reminders bell */}
            <div className="relative">
              <button onClick={() => setBellOpen((o) => !o)}
                className={`relative rounded-lg border p-2 transition-all active:scale-95
                  ${reminders.length ? "border-tang/40 bg-tangmist text-tang" : "border-line bg-card text-inkfaint hover:text-ink"}`}
                aria-label="Reminders">
                <span className={criticalCount ? "anim-shake inline-flex" : "inline-flex"}>
                  <Bell size={15} />
                </span>
                {reminders.length > 0 && (
                  <span className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold text-white
                    ${criticalCount ? "bg-ember" : "bg-tang"}`}>
                    {reminders.length}
                  </span>
                )}
              </button>
              {bellOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
                  <div className="anim-pop absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-xl border border-line bg-card shadow-xl shadow-night/15">
                    <div className="border-b border-linesoft bg-paper/70 px-3.5 py-2.5">
                      <p className="font-display text-[12.5px] font-semibold text-ink">Reminders</p>
                      <p className="font-mono text-[10px] text-inkfaint">urgency rises as deadlines approach</p>
                    </div>
                    <div className="max-h-[380px] overflow-y-auto">
                      {reminders.length ? reminders.map((r) => {
                        return (
                          <button key={r.id}
                            onClick={() => { setBellOpen(false); if (r.taskId) setDrawerId(r.taskId); }}
                            className="flex w-full items-start gap-2.5 border-b border-linesoft px-3.5 py-2.5 text-left transition-colors last:border-0 hover:bg-mist">
                            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[r.severity]}`} />
                            <span className="min-w-0">
                              <span className="block truncate text-[12.5px] font-semibold leading-snug text-ink">{r.title}</span>
                              <span className="mt-0.5 block text-[11px] leading-snug text-inksoft">{r.detail}</span>
                            </span>
                          </button>
                        );
                      }) : (
                        <p className="px-3.5 py-6 text-center text-[12px] text-inkfaint">All caught up — no reminders right now.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setCaptureOpen(true)}
              className="hidden items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-[12.5px] font-medium text-inksoft transition-all hover:border-pine hover:text-pine active:scale-95 lg:inline-flex">
              <Zap size={13} /> Quick capture <Kbd>⌘K</Kbd>
            </button>
            <button onClick={() => setModal({ open: true, taskId: null })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-3 py-2 text-[12.5px] font-bold text-white shadow-sm transition-all hover:bg-pinedeep hover:shadow-md active:scale-95">
              <Plus size={14} /> <span className="hidden sm:inline">New task</span>
            </button>
            <span className="hidden rounded-lg border border-line bg-card px-2.5 py-2 font-mono text-[11px] tabular-nums text-inksoft xl:block">
              {now.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
          <div key={view} className="anim-fade mx-auto h-full max-w-[1320px]">
            {view === "dashboard" && (
              <Dashboard
                onOpenTask={setDrawerId}
                onNavigate={setView}
                onNewTask={() => setModal({ open: true, taskId: null })}
                onStartFocus={() => setFocus({ open: true, taskId: null })}
              />
            )}
            {view === "board" && <Board onOpenTask={setDrawerId} onNewTask={(status) => setModal({ open: true, taskId: null, defaults: { status } })} />}
            {view === "tasks" && <TasksView onOpenTask={setDrawerId} query={query} setQuery={setQuery} />}
            {view === "plan" && <PlanDay onOpenTask={setDrawerId} />}
            {view === "reports" && <Reports />}
          </div>
        </main>

        <footer className="border-t border-line bg-card/60 px-4 py-1.5 md:px-6">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-inkfaint">
            <span>{fmtDateLong(todayISO())}</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">{openCount} open · {plannedCount} planned today</span>
            <span className="ml-auto hidden items-center gap-1 md:flex">
              <Kbd>1</Kbd>–<Kbd>6</Kbd> switch views
            </span>
          </p>
        </footer>
      </div>

      {/* Overlays */}
      <TaskModal
        open={modal.open}
        onClose={() => setModal({ open: false })}
        taskId={modal.taskId ?? null}
        defaults={modal.defaults ? { status: modal.defaults.status } : undefined}
      />
      <TaskDrawer
        taskId={drawerId}
        onClose={() => setDrawerId(null)}
        onEdit={(id) => setModal({ open: true, taskId: id })}
        onPlan={handlePlanToggle}
      />
      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
      <FocusMode open={focus.open} initialTaskId={focus.taskId} onClose={() => setFocus((f) => ({ ...f, open: false }))} />
      <ChangePasswordModal open={pwModal} onClose={() => setPwModal(false)} />
    </div>
  );
}

/* --------------------------------- Auth gate ------------------------------ */

function BootSplash() {
  return (
    <div className="night-texture flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span className="anim-breathe"><TempoLogo size={52} light /></span>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-nighttext/70">Unlocking workspace…</p>
      </div>
    </div>
  );
}

function Gate() {
  const auth = useAuth();
  if (auth.phase === "booting") return <BootSplash />;
  if (auth.phase !== "ready" || !auth.user || !auth.appState) return <AuthScreen />;
  return (
    <StoreProvider key={auth.user.uid} initial={auth.appState} onPersist={auth.persist}>
      <Shell />
    </StoreProvider>
  );
}

export default function App() {
  return (
    <AuthProvider freshState={buildFreshState}>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  );
}
