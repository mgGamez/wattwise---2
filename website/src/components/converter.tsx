"use client";

import { motion } from "framer-motion";
import { ratesFromInterval, intervalFromTotal, fmtBoth } from "@/lib/units";
import { Segmented } from "./ui";
import { useReduceMotion, SPRING } from "./motion";

/**
 * Converts a monthly or daily total (kWh, as on a bill) into every period the
 * model and people think in — down to Wh per 10 minutes.
 * Example: 369 kWh/month → 12.3 kWh/day → 0.5125 kWh/hour → 85.4 Wh per 10 minutes.
 */
export function UsageConverter({
  value,
  onChange,
}: {
  value: { amount: string; period: "month" | "day" };
  onChange: (v: { amount: string; period: "month" | "day" }) => void;
}) {
  const reduce = useReduceMotion();
  const n = Number(value.amount.replace(",", "."));
  const valid = value.amount.trim() !== "" && Number.isFinite(n) && n > 0;
  const rows = valid ? ratesFromInterval(intervalFromTotal(n, value.period)) : [];

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-ink">Your usage</span>
          <div className="mt-1.5 flex h-12 w-44 items-center rounded-2xl border border-line-strong bg-surface px-3 focus-within:border-blue">
            <input
              aria-label="Usage in kWh"
              inputMode="decimal"
              value={value.amount}
              onChange={(e) => onChange({ ...value, amount: e.target.value })}
              className="num w-full bg-transparent text-lg font-semibold text-ink outline-none"
            />
            <span className="text-sm font-medium text-ink-3">kWh</span>
          </div>
        </label>
        <Segmented
          label="Usage period"
          value={value.period}
          onChange={(period) => onChange({ ...value, period })}
          options={[
            { value: "month", label: "per month" },
            { value: "day", label: "per day" },
          ]}
        />
      </div>
      <p className="mt-2 text-xs text-ink-3">1 kWh = 1,000 Wh = one “unit” on most electricity bills. A month is taken as 30 days.</p>
      {valid && (
        <table className="mt-3 w-full overflow-hidden rounded-2xl border border-line text-sm">
          <caption className="sr-only">Your usage converted to other periods</caption>
          <tbody className="divide-y divide-line bg-surface">
            {rows.map((r, i) => (
              <motion.tr
                key={r.key}
                initial={reduce ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING, delay: i * 0.04 }}
                className={r.key === "tenMin" ? "bg-sage-soft/60" : ""}
              >
                <th scope="row" className="px-4 py-2 text-left font-medium text-ink-2">
                  {r.label}
                </th>
                <td className={`num px-4 py-2 text-right ${r.key === "tenMin" ? "font-bold text-sage-strong" : "text-ink"}`}>{fmtBoth(r.wh)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      )}
      {valid && (
        <p className="mt-2 text-xs text-ink-3">
          WATTWISE compares 10-minute readings, so the highlighted row is the average it would expect if your use were perfectly even.
        </p>
      )}
    </div>
  );
}
