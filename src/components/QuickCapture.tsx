import { useEffect, useMemo, useState } from "react";
import { CornerDownLeft, Zap } from "lucide-react";
import { useStore, useToasts } from "../store";
import { parseCapture } from "../lib/capture";
import { Kbd, PriorityBadge, ProjectChip, TagChip } from "./ui";
import { fmtDate, fmtMinutes } from "../lib/dates";

export default function QuickCapture({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { projects, addTask, state } = useStore();
  const { push } = useToasts();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) setValue("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const parsed = useMemo(() => parseCapture(value, projects), [value, projects]);
  const recent = state.tasks.slice(0, 4);

  const submit = () => {
    if (!parsed.title.trim()) return;
    const t = addTask({
      title: parsed.title,
      description: parsed.description,
      priority: parsed.priority ?? "medium",
      project: parsed.project ?? "General",
      dueDate: parsed.dueDate,
      estimatedMinutes: parsed.estimatedMinutes ?? 30,
      tags: parsed.tags,
      recurrence: parsed.recurrence,
    });
    push("success", "Captured", `“${t.title}” → ${t.project}${t.dueDate ? `, due ${fmtDate(t.dueDate)}` : ""}`);
    setValue("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[14vh]">
      <div className="anim-fade fixed inset-0 bg-night/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="anim-pop relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-card shadow-2xl shadow-night/30">
        <div className="flex items-center gap-3 border-b border-linesoft px-4 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-night text-mint">
            <Zap size={15} />
          </span>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Capture a task in plain language…"
            className="flex-1 bg-transparent font-display text-[15px] font-medium text-ink outline-none placeholder:text-inkfaint"
          />
          <button onClick={submit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-pine px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-pinedeep active:scale-95">
            Add <CornerDownLeft size={12} />
          </button>
        </div>

        {/* Live parse preview */}
        <div className="flex min-h-[52px] flex-wrap items-center gap-1.5 border-b border-linesoft bg-paper/70 px-4 py-2.5">
          {value.trim() ? (
            <>
              <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Parsed</span>
              {parsed.priority && <PriorityBadge p={parsed.priority} />}
              {parsed.project && <ProjectChip name={parsed.project} />}
              {parsed.dueDate && (
                <span className="rounded-md bg-ambrmist px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-amber">
                  due {fmtDate(parsed.dueDate)}
                </span>
              )}
              {parsed.estimatedMinutes && (
                <span className="rounded-md bg-steelmist px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-steel">
                  est {fmtMinutes(parsed.estimatedMinutes)}
                </span>
              )}
              {parsed.recurrence !== "none" && (
                <span className="rounded-md bg-pinemist px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-pine">
                  {parsed.recurrence}
                </span>
              )}
              {parsed.tags.map((t) => <TagChip key={t} tag={t} />)}
              {!parsed.priority && !parsed.project && !parsed.dueDate && !parsed.estimatedMinutes && parsed.tags.length === 0 && parsed.recurrence === "none" && (
                <span className="text-xs text-inkfaint">Plain task · Medium priority · General project · 30m estimate</span>
              )}
            </>
          ) : (
            <span className="text-xs text-inkfaint">
              Try: <span className="font-mono text-inksoft">Send invoice to Meridian !high #finance due friday 20m</span>
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-[11px] text-inkfaint">
          <span><Kbd>!high</Kbd> priority</span>
          <span><Kbd>#tag</Kbd> tag / project</span>
          <span><Kbd>due fri</Kbd> · <Kbd>due in 3d</Kbd> deadline</span>
          <span><Kbd>45m</Kbd> estimate</span>
          <span><Kbd>rec:weekly</Kbd> recurring</span>
          <span><Kbd> - </Kbd> description</span>
        </div>

        {recent.length > 0 && (
          <div className="border-t border-linesoft bg-paper/50 px-4 py-2">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-inkfaint">Recently added</p>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {recent.map((t) => (
                <span key={t.id} className="max-w-[220px] truncate rounded-md border border-line bg-card px-2 py-1 text-[11px] text-inksoft">
                  {t.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
