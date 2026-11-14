// Energy units, explained. The model works in Wh per 10-minute interval;
// people usually know kWh per month (their bill) or per day.
//   1 kWh = 1,000 Wh · 1 hour = 6 intervals · 1 day = 144 · 30-day month = 4,320

export const INTERVALS = { tenMin: 1, hour: 6, sixHours: 36, day: 144, month: 4320 } as const;

export type RateRow = { key: keyof typeof INTERVALS; label: string; wh: number };

const LABELS: Record<keyof typeof INTERVALS, string> = {
  month: "Per month (30 days)",
  day: "Per day (24 hours)",
  sixHours: "Per 6 hours",
  hour: "Per hour",
  tenMin: "Per 10 minutes",
};

/** Same rate of use expressed over longer periods (largest first). */
export function ratesFromInterval(perIntervalWh: number): RateRow[] {
  return (["month", "day", "sixHours", "hour", "tenMin"] as const).map((key) => ({
    key,
    label: LABELS[key],
    wh: perIntervalWh * INTERVALS[key],
  }));
}

/** Average Wh per 10 minutes from a total over a month or a day (in kWh). */
export function intervalFromTotal(totalKwh: number, period: "month" | "day") {
  return (totalKwh * 1000) / INTERVALS[period];
}

const num = (v: number, max: number) => v.toLocaleString("en", { maximumFractionDigits: max });

/** "85.4 Wh" below 1 kWh, otherwise "12.3 kWh". */
export function fmtEnergy(wh: number) {
  const a = Math.abs(wh);
  if (a < 1000) return `${num(wh, a < 10 ? 2 : 1)} Wh`;
  return `${num(wh / 1000, a < 10_000 ? 3 : a < 100_000 ? 2 : 1)} kWh`;
}

/** "0.085 kWh (85.4 Wh)" — both units, for people who know only one. */
export function fmtBoth(wh: number) {
  const kwh = wh / 1000;
  const kDigits = Math.abs(kwh) >= 100 ? 1 : Math.abs(kwh) >= 1 ? 3 : 4;
  return `${num(kwh, kDigits)} kWh (${num(wh, Math.abs(wh) < 100 ? 1 : 0)} Wh)`;
}
