import { useEffect } from "react";
import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { Priority, Status } from "../types";
import { PRIORITY_META, STATUS_META, projectChip } from "../lib/engine";
import { dueLabel } from "../lib/dates";

export function PriorityBadge({ p, size = "sm" }: { p: Priority; size?: "sm" | "md" }) {
  const m = PRIORITY_META[p];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-medium ${m.chip} ${size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function StatusBadge({ s, size = "sm" }: { s: Status; size?: "sm" | "md" }) {
  const m = STATUS_META[s];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-medium ${m.chip} ${size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function ProjectChip({ name }: { name: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${projectChip(name)}`}>
      {name}
    </span>
  );
}

export function DueChip({ due, done }: { due: string | null; done?: boolean }) {
  const { text, tone } = dueLabel(due);
  const cls =
    done ? "bg-linesoft text-inkfaint"
    : tone === "over" ? "bg-embermist text-ember font-semibold"
    : tone === "today" ? "bg-ambrmist text-amber font-semibold"
    : tone === "soon" ? "bg-tangmist text-tang"
    : "bg-linesoft text-inksoft";
  return <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10.5px] ${cls}`}>{text}</span>;
}

export function TagChip({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center rounded border border-line bg-paper px-1 py-px font-mono text-[10px] text-inksoft">
      #{tag}
    </span>
  );
}

/** 0–100 priority score as a small horizontal meter */
export function ScoreMeter({ score }: { score: number }) {
  const color = score >= 70 ? "bg-ember" : score >= 45 ? "bg-tang" : score >= 25 ? "bg-pine" : "bg-sage";
  return (
    <span className="inline-flex items-center gap-1.5" title={`Priority score ${score}/100`}>
      <span className="relative h-[5px] w-9 overflow-hidden rounded-full bg-linesoft">
        <span className={`anim-bar absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: `${score}%` }} />
      </span>
      <span className="font-mono text-[10.5px] tabular-nums text-inksoft w-5 text-right">{score}</span>
    </span>
  );
}

export function ProgressBar({ value, tone = "pine", className = "" }: { value: number; tone?: "pine" | "tang" | "ember"; className?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const color = tone === "ember" ? "bg-ember" : tone === "tang" ? "bg-tang" : "bg-pine";
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-linesoft ${className}`}>
      <div className={`h-full rounded-full ${color} transition-all duration-700 ease-out`} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function TaskCheck({ done, onToggle, size = 18 }: { done: boolean; onToggle: () => void; size?: number }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={done ? "Mark as not done" : "Mark as done"}
      className={`group/check flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200
        ${done ? "border-doneg bg-doneg text-white" : "border-line bg-card text-transparent hover:border-pine hover:text-pine/40"}`}
      style={{ width: size, height: size }}
    >
      <Check size={size - 7} strokeWidth={3.2} className={`transition-transform duration-200 ${done ? "scale-100" : "scale-50 group-hover/check:scale-100"}`} />
    </button>
  );
}

export function Modal({ open, onClose, children, width = "max-w-lg" }: {
  open: boolean; onClose: () => void; children: ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
      <div className="anim-fade fixed inset-0 bg-night/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`anim-pop relative w-full ${width} rounded-xl border border-line bg-card shadow-2xl shadow-night/25`}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, onClose, kicker }: { title: string; onClose: () => void; kicker?: string }) {
  return (
    <div className="flex items-start justify-between border-b border-linesoft px-5 py-4">
      <div>
        {kicker && <p className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-pine">{kicker}</p>}
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      </div>
      <button onClick={onClose} className="rounded-md p-1.5 text-inkfaint transition-colors hover:bg-mist hover:text-ink" aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-paper/60 px-6 py-10 text-center">
      <span className="text-inkfaint">{icon}</span>
      <p className="font-display text-[15px] font-semibold text-inksoft">{title}</p>
      {hint && <p className="max-w-[300px] text-xs leading-relaxed text-inkfaint">{hint}</p>}
      {action}
    </div>
  );
}

export function SectionHead({ title, count, right }: { title: string; count?: number; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="flex items-center gap-2 font-display text-[13px] font-semibold uppercase tracking-[0.08em] text-inksoft">
        {title}
        {count != null && (
          <span className="rounded-full bg-linesoft px-1.5 py-px font-mono text-[10.5px] font-medium text-inksoft">{count}</span>
        )}
      </h3>
      {right}
    </div>
  );
}

export function Kbd({ dark, children }: { dark?: boolean; children: ReactNode }) {
  return <kbd className={dark ? "tempo-kbd-dark" : "tempo-kbd"}>{children}</kbd>;
}

export const inputCls =
  "w-full rounded-lg border border-line bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-inkfaint outline-none transition-all focus:border-pine focus:ring-2 focus:ring-pine/15";

export const selectCls =
  "rounded-lg border border-line bg-paper px-2.5 py-1.5 text-[12.5px] text-ink outline-none transition-all focus:border-pine focus:ring-2 focus:ring-pine/15 cursor-pointer";

export function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block font-mono text-[10.5px] uppercase tracking-[0.12em] text-inkfaint">{label}</span>
      {children}
    </label>
  );
}
