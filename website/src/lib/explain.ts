// Plain-language explanation of a bill result. "Facts" are computed from the bills
// and the fitted model; "possible explanations" are clearly framed as things to
// consider, because WATTWISE can't see devices or people.

import type { Analysis } from "./storage";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTHS[mo - 1]} ${y}`;
};
export const monthShort = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTHS[mo - 1].slice(0, 3)} ${String(y).slice(2)}`;
};

// always kWh here so every number in an explanation shares one unit
const yearAgo = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return `${y - 1}-${String(mo).padStart(2, "0")}`;
};
const kwh = (v: number) => `${v.toLocaleString("en", { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 1 })} kWh`;

export function explainBill(a: Pick<Analysis, "current" | "history" | "result">) {
  const r = a.result;
  const f = r.fit;
  const facts: string[] = [];
  const diff = Math.abs(r.residualKwh);
  const pct = r.expectedKwh > 0 ? Math.round((diff / r.expectedKwh) * 100) : null;

  if (f.method === "seasonal" && f.seasonal) {
    const s = f.seasonal;
    const change = Math.round((s.levelRatio - 1) * 100);
    facts.push(
      `Last year, ${monthName(s.month)} used ${kwh(s.perDay)} per day.${
        s.levelMonths === 0
          ? " There are no bills from the months just before it to compare your current level with, so WATTWISE uses it as-is."
          : change !== 0
            ? ` Your recent months are ${Math.abs(change)}% ${change > 0 ? "higher" : "lower"} than the same months a year earlier, so WATTWISE adjusts that to ${kwh(r.expectedPerDay)} per day.`
            : " Your recent months are at the same level as the same months a year earlier."
      }`,
    );
  } else
    facts.push(
      f.method === "trend"
        ? `Your ${f.n} past months show a trend of ${f.slope >= 0 ? "+" : "−"}${kwh(Math.abs(f.slope))} per day each month, which points to about ${kwh(r.expectedPerDay)} per day now.`
        : `Your ${f.n} past months averaged ${kwh(f.meanPerDay)} per day.`,
    );
  facts.push(
    `This bill works out to ${kwh(r.actualPerDay)} per day over ${a.current.days % 1 ? a.current.days.toFixed(1) : a.current.days} days, against an expected ${kwh(r.expectedPerDay)} per day.`,
  );
  facts.push(`Your bills usually vary by about ±${kwh(f.sigma)} per day from month to month.`);
  if (r.flagged)
    facts.push(
      `This month is ${r.z.toFixed(1)}× that usual variation above normal (${kwh(diff)}${pct !== null ? `, ${pct}%` : ""} more). Bills this far above normal are rare, so WATTWISE flags it.`,
    );
  else if (r.low) facts.push(`This month is ${Math.abs(r.z).toFixed(1)}× the usual variation below normal (${kwh(diff)} less).`);
  else
    facts.push(
      `The difference (${r.residualKwh >= 0 ? "+" : "−"}${kwh(diff)}) is within your usual month-to-month variation, so it’s normal.`,
    );
  if (f.method !== "seasonal")
    facts.push(
      `Seasons aren’t accounted for yet. Add your bill from ${monthName(yearAgo(a.current.month))} and WATTWISE will compare against the same month last year.`,
    );
  const highest = [...a.history].sort((x, y) => y.kwh / y.days - x.kwh / x.days)[0];
  if (highest && r.actualPerDay > highest.kwh / highest.days)
    facts.push(`It’s your highest daily use so far (previous highest: ${kwh(highest.kwh / highest.days)} per day, ${monthName(highest.month)}).`);

  const possible = r.flagged
    ? [
        f.method === "seasonal"
          ? "More heating or cooling than the same month last year (a hotter or colder month, or new settings)."
          : "A hotter or colder month than your past bills. Seasons aren’t accounted for until last year’s bill is added.",
        "More people or more time spent at home or at work.",
        "A new appliance, or one that’s faulty or left running.",
        "A longer billing period or an estimated meter reading. Check the dates and reading type on the bill.",
      ]
    : r.low
      ? [
          "Milder weather, so less heating or cooling.",
          "Time away, or fewer people using the building.",
          "A shorter billing period or an estimated reading. Check the bill dates.",
        ]
      : ["Normal month-to-month ups and downs. Nothing here stands out from your usual pattern."];

  return { facts, possible };
}
