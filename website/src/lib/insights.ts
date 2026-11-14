// Aggregations over the user's SAVED analyses only. Nothing here invents data:
// a period with no analyses is simply not returned.

import type { Analysis } from "./storage";
import { hourOf, nowLocal, parseLocal } from "./time";

export type PeriodTotal = { key: string; label: string; count: number; flagged: number; excessWh: number };

export function periodTotals(analyses: Analysis[], now = nowLocal()): PeriodTotal[] {
  const n = parseLocal(now);
  const today = now.slice(0, 10);
  const weekStart = Date.UTC(n.y, n.m - 1, n.day) - 6 * 86_400_000; // last 7 days incl. today
  const month = now.slice(0, 7);
  const defs = [
    { key: "today", label: "Today", test: (a: Analysis) => a.timestamp.slice(0, 10) === today },
    {
      key: "week",
      label: "Last 7 days",
      test: (a: Analysis) => {
        const p = parseLocal(a.timestamp);
        const day = Date.UTC(p.y, p.m - 1, p.day);
        return day >= weekStart && day <= Date.UTC(n.y, n.m - 1, n.day);
      },
    },
    { key: "month", label: "This month", test: (a: Analysis) => a.timestamp.slice(0, 7) === month },
  ];
  return defs
    .map((d) => {
      const list = analyses.filter(d.test);
      return {
        key: d.key,
        label: d.label,
        count: list.length,
        flagged: list.filter((a) => a.result.flagged).length,
        excessWh: list.reduce((s, a) => s + a.result.potentialExcessWh, 0),
      };
    })
    .filter((p) => p.count > 0);
}

export function allTimeTotal(analyses: Analysis[]): PeriodTotal {
  return {
    key: "all",
    label: "All saved analyses",
    count: analyses.length,
    flagged: analyses.filter((a) => a.result.flagged).length,
    excessWh: analyses.reduce((s, a) => s + a.result.potentialExcessWh, 0),
  };
}

export const byReadingTime = (a: Analysis, b: Analysis) => a.timestamp.localeCompare(b.timestamp);

/** Count of analyses and unusual analyses for each hour of the day. */
export function byHour(analyses: Analysis[]) {
  const rows = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, flagged: 0 }));
  for (const a of analyses) {
    const r = rows[hourOf(a.timestamp)];
    r.total++;
    if (a.result.flagged) r.flagged++;
  }
  return rows;
}

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
  return a.result.residualWh < 0 ? "below" : "normal";
}
