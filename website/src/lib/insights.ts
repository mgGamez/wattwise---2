// Aggregations over the user's SAVED bill analyses only. Nothing is invented:
// periods without analyses are simply not returned.

import type { Analysis } from "./storage";
import { monthIndex } from "./ml/bills";

export type PeriodTotal = { key: string; label: string; count: number; flagged: number; excessKwh: number };

const sum = (list: Analysis[]) => ({
  count: list.length,
  flagged: list.filter((a) => a.result.flagged).length,
  excessKwh: list.reduce((s, a) => s + a.result.potentialExcessKwh, 0),
});

/** "This year" and "Last 12 months" by bill month, only when they contain analyses. */
export function periodTotals(analyses: Analysis[], now = new Date()): PeriodTotal[] {
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const defs = [
    { key: "year", label: `This year (${now.getFullYear()})`, test: (a: Analysis) => a.month.startsWith(String(now.getFullYear())) },
    { key: "12m", label: "Last 12 months", test: (a: Analysis) => thisMonth - monthIndex(a.month) < 12 && thisMonth >= monthIndex(a.month) },
  ];
  return defs.map((d) => ({ key: d.key, label: d.label, ...sum(analyses.filter(d.test)) })).filter((p) => p.count > 0);
}

export function allTimeTotal(analyses: Analysis[]): PeriodTotal {
  return { key: "all", label: "All saved analyses", ...sum(analyses) };
}

export const byMonth = (a: Analysis, b: Analysis) => a.month.localeCompare(b.month);

export function checksProgress(analyses: Analysis[], checks: Record<string, Record<string, string>>) {
  let total = 0;
  let done = 0;
  for (const a of analyses) {
    total += a.actions.length;
    done += a.actions.filter((x) => checks[a.id]?.[x.id]).length;
  }
  return { total, done };
}

export function statusOf(a: Analysis): "unusual" | "normal" | "below" {
  if (a.result.flagged) return "unusual";
  return a.result.low ? "below" : "normal";
}
