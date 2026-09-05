import type { Priority, Recurrence } from "../types";
import { addDaysISO, parseISODate, toISODate, todayISO } from "./dates";

export interface ParsedCapture {
  title: string;
  description: string;
  priority: Priority | null;
  project: string | null;
  dueDate: string | null;
  estimatedMinutes: number | null;
  tags: string[];
  recurrence: Recurrence;
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function parseDue(token: string): string | null {
  const t = token.toLowerCase();
  const today = todayISO();
  if (t === "today" || t === "tod" || t === "tdy") return today;
  if (t === "tomorrow" || t === "tmr" || t === "tom") return addDaysISO(today, 1);
  const inMatch = t.match(/^in\s*(\d+)\s*(d|day|days|w|week|weeks)$/);
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    return addDaysISO(today, inMatch[5]?.startsWith("w") ? n * 7 : n);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const short = t.slice(0, 3);
  const idx = WEEKDAYS.findIndex((w) => w.startsWith(short) && short.length >= 3);
  if (idx >= 0) {
    const base = parseISODate(today);
    let delta = (idx - base.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    return addDaysISO(today, delta);
  }
  return null;
}

/**
 * Natural-language quick capture.
 * Syntax:  Fix the payroll export !high #finance due friday 45m rec:weekly
 *          - !priority  (!c !h !m !l or !critical !high !med !low)
 *          - #tag (becomes the project when it matches a known project)
 *          - due today | tomorrow | friday | 2026-03-01 | in 3d
 *          - 45m / 1h30m estimate
 *          - rec:daily | weekdays | weekly | monthly
 *          - text after " - " becomes the description
 */
export function parseCapture(input: string, knownProjects: string[]): ParsedCapture {
  let rest = input;
  let description = "";
  const dashIdx = rest.indexOf(" - ");
  if (dashIdx > 0) {
    description = rest.slice(dashIdx + 3).trim();
    rest = rest.slice(0, dashIdx);
  }

  let priority: Priority | null = null;
  let project: string | null = null;
  let dueDate: string | null = null;
  let estimatedMinutes: number | null = null;
  let recurrence: Recurrence = "none";
  const tags: string[] = [];

  const tokens = rest.split(/\s+/).filter(Boolean);
  const kept: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const low = tok.toLowerCase();

    const priMatch = low.match(/^!(c|crit|critical|h|hi|high|m|med|medium|l|low|u|urgent|p1|p2|p3|p4)$/);
    if (priMatch) {
      const p = priMatch[1];
      priority = p.startsWith("c") || p === "u" || p === "p1" ? "critical"
        : p.startsWith("h") || p === "p2" ? "high"
        : p.startsWith("m") || p === "p3" ? "medium" : "low";
      continue;
    }

    if (low === "due" && tokens[i + 1]) {
      // "due in 3d" spans 3 tokens
      if (tokens[i + 1].toLowerCase() === "in" && tokens[i + 2]) {
        const d = parseDue(`in ${tokens[i + 2]}`);
        if (d) { dueDate = d; i += 2; continue; }
      }
      const d = parseDue(tokens[i + 1]);
      if (d) { dueDate = d; i += 1; continue; }
    }

    const estMatch = low.match(/^@?(\d+)h(\d+)?m?$/) || low.match(/^@?(\d+)m$/);
    if (estMatch) {
      const h = parseInt(estMatch[1], 10);
      const m = estMatch[2] ? parseInt(estMatch[2], 10) : 0;
      estimatedMinutes = low.includes("h") ? h * 60 + m : h;
      continue;
    }

    const recMatch = low.match(/^rec:(daily|weekdays|weekly|monthly)$/);
    if (recMatch) {
      recurrence = recMatch[1] as Recurrence;
      continue;
    }

    if (low.startsWith("#") && low.length > 1) {
      const name = tok.slice(1);
      const matchProject = knownProjects.find((p) => p.toLowerCase() === name.toLowerCase());
      if (matchProject) project = matchProject;
      else tags.push(name.toLowerCase());
      continue;
    }

    kept.push(tok);
  }

  return {
    title: kept.join(" ").trim() || input.trim(),
    description,
    priority,
    project,
    dueDate,
    estimatedMinutes,
    tags,
    recurrence,
  };
}
