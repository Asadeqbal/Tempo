export const DAY = 86400000;

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysFromToday(iso: string): number {
  const a = parseISODate(todayISO()).getTime();
  const b = parseISODate(iso).getTime();
  return Math.round((b - a) / DAY);
}

export function daysBetween(fromISO: string, toISOStr: string): number {
  return Math.round(
    (parseISODate(toISOStr).getTime() - parseISODate(fromISO).getTime()) / DAY
  );
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return parseISODate(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function fmtDateLong(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function fmtTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDateTime(isoDateTime: string): string {
  return `${fmtDate(toISODate(new Date(isoDateTime)))} · ${fmtTime(isoDateTime)}`;
}

/** Relative due label: "3d overdue", "today", "tomorrow", "in 4d" */
export function dueLabel(iso: string | null): { text: string; tone: "over" | "today" | "soon" | "later" | "none" } {
  if (!iso) return { text: "no due date", tone: "none" };
  const diff = daysFromToday(iso);
  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, tone: "over" };
  if (diff === 0) return { text: "today", tone: "today" };
  if (diff === 1) return { text: "tomorrow", tone: "soon" };
  if (diff <= 3) return { text: `in ${diff}d`, tone: "soon" };
  return { text: `in ${diff}d`, tone: "later" };
}

export function relativeFrom(isoDateTime: string): string {
  const diff = Date.now() - new Date(isoDateTime).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d}d ago`;
  return fmtDate(toISODate(new Date(isoDateTime)));
}

export function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtHours(min: number): string {
  return `${(min / 60).toFixed(1)}h`;
}

export function isWorkday(iso: string): boolean {
  const dow = parseISODate(iso).getDay();
  return dow !== 0 && dow !== 6;
}

export function nextOccurrence(fromISO: string, recurrence: string): string {
  switch (recurrence) {
    case "daily":
      return addDaysISO(fromISO, 1);
    case "weekdays": {
      let next = addDaysISO(fromISO, 1);
      while (!isWorkday(next)) next = addDaysISO(next, 1);
      return next;
    }
    case "weekly":
      return addDaysISO(fromISO, 7);
    case "monthly": {
      const d = parseISODate(fromISO);
      d.setMonth(d.getMonth() + 1);
      return toISODate(d);
    }
    default:
      return fromISO;
  }
}

export function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDaysISO(todayISO(), -i));
  return out;
}

export function weekdayShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { weekday: "short" });
}
