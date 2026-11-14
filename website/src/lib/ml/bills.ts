// WATTWISE bill model: learns what's normal from the user's OWN past bills, in the
// browser, then judges the current bill against it. No imports, so Node can test it.
//
// Everything works in kWh per day, so bills covering different numbers of days compare fairly.
//
// Expected daily use for the bill month:
//   seasonal : the same month last year is known → that month's daily use, scaled by how
//              the last 3 months compare with the same 3 months a year earlier (level change)
//   trend    : >= 6 past months, no year-ago month → least-squares trend line
//   average  : otherwise → mean daily use of past months
//
// Typical variation (sigma):
//   residual spread of the method, shrunk toward a typical household month-to-month
//   variation (PRIOR_CV of daily use, worth PRIOR_WEIGHT months of evidence) so a few
//   very similar bills can't make every small change look unusual, then widened for
//   the uncertainty of the fit itself (standard prediction-interval correction).
// Unusual: >= 2 sigma above expected (about the top 2.5%); much lower: <= -2 sigma.

export type Bill = { month: string; kwh: number; days: number }; // month = "YYYY-MM"

export type BillFit = {
  method: "average" | "trend" | "seasonal";
  n: number;
  intercept: number; // kWh/day at month index 0 (average/trend)
  slope: number; // kWh/day change per month (trend only)
  sigma: number; // prediction standard deviation for the bill month, kWh/day
  meanPerDay: number;
  /** seasonal only: the year-ago month used and the level adjustment applied */
  seasonal?: { month: string; perDay: number; levelRatio: number; levelMonths: number; pairs: number };
};

export type BillResult = {
  expectedPerDay: number;
  actualPerDay: number;
  expectedKwh: number; // for the current bill's days
  residualKwh: number; // actual − expected
  z: number;
  percentile: number; // 0–100, normal CDF of z
  flagged: boolean;
  low: boolean;
  potentialExcessKwh: number; // residual only when flagged
  fit: BillFit;
};

export const MIN_HISTORY = 3;
const TREND_FROM = 6;
const Z_FLAG = 2;
export const PRIOR_CV = 0.1; // typical household month-to-month variation (assumption, documented)
export const PRIOR_WEIGHT = 2; // ...counted as this many months of evidence

export const monthIndex = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return y * 12 + (mo - 1);
};
const fromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

export function daysInMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, error < 1.5e-7). */
export function normalCdf(z: number) {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Shrink a sample variance toward the typical-household prior. */
function shrunkVariance(sse: number, dof: number, mean: number) {
  const prior = (PRIOR_CV * mean) ** 2;
  return (PRIOR_WEIGHT * prior + Math.max(sse, 0)) / (PRIOR_WEIGHT + Math.max(dof, 0));
}

/** Daily use by month index. */
const perDayMap = (bills: Bill[]) => new Map(bills.map((b) => [monthIndex(b.month), b.kwh / b.days]));

/**
 * Seasonal expectation for target month t, or null if the year-ago month is missing.
 * level ratio = mean(t−1..t−3) / mean(t−13..t−15) over the months where both exist (clamped 0.5–2).
 */
function seasonalExpectation(map: Map<number, number>, t: number) {
  const base = map.get(t - 12);
  if (base === undefined) return null;
  let now = 0;
  let then = 0;
  let k = 0;
  for (let i = 1; i <= 3; i++) {
    const a = map.get(t - i);
    const b = map.get(t - 12 - i);
    if (a !== undefined && b !== undefined) {
      now += a;
      then += b;
      k++;
    }
  }
  const ratio = k && then > 0 ? Math.min(2, Math.max(0.5, now / then)) : 1;
  return { base, ratio, levelMonths: k, expected: base * ratio };
}

/** Fit the model that will judge month `target` (history must be earlier months). */
export function fitBills(history: Bill[], target?: string): BillFit {
  if (history.length < MIN_HISTORY) throw new Error(`Need at least ${MIN_HISTORY} past months`);
  const xs = history.map((b) => monthIndex(b.month));
  const ys = history.map((b) => b.kwh / b.days);
  const n = ys.length;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  const t = target ? monthIndex(target) : Math.max(...xs) + 1;

  // ---- seasonal: year-ago month known
  const map = perDayMap(history);
  const season = seasonalExpectation(map, t);
  if (season) {
    // in-sample errors of the same rule, for every history month that has its own year-ago month
    let sse = 0;
    let pairs = 0;
    for (const x of xs) {
      const e = seasonalExpectation(map, x);
      if (e) {
        sse += (map.get(x)! - e.expected) ** 2;
        pairs++;
      }
    }
    const variance = shrunkVariance(sse, pairs, meanY);
    return {
      method: "seasonal",
      n,
      intercept: season.expected,
      slope: 0,
      sigma: Math.sqrt(variance),
      meanPerDay: meanY,
      seasonal: { month: fromIndex(t - 12), perDay: season.base, levelRatio: season.ratio, levelMonths: season.levelMonths, pairs },
    };
  }

  // ---- average or trend
  let intercept = meanY;
  let slope = 0;
  let method: BillFit["method"] = "average";
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const sxx = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  if (n >= TREND_FROM && sxx > 0) {
    slope = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0) / sxx;
    intercept = meanY - slope * meanX;
    method = "trend";
  }
  const p = method === "trend" ? 2 : 1;
  const sse = ys.reduce((s, y, i) => s + (y - (intercept + slope * xs[i])) ** 2, 0);
  const variance = shrunkVariance(sse, n - p, meanY);
  // prediction interval: add the uncertainty of the fitted mean / line at month t
  const leverage = method === "trend" ? 1 / n + (t - meanX) ** 2 / sxx : 1 / n;
  return { method, n, intercept, slope, sigma: Math.sqrt(variance * (1 + leverage)), meanPerDay: meanY };
}

export function analyseBill(history: Bill[], current: Bill): BillResult {
  if (!(current.kwh >= 0) || !(current.days > 0)) throw new Error("Bill needs kWh ≥ 0 and days > 0");
  if (history.some((b) => b.month >= current.month)) throw new Error("History must be months before the bill being analysed");
  const fit = fitBills(history, current.month);
  const expectedPerDay = Math.max(0, fit.intercept + fit.slope * monthIndex(current.month));
  const actualPerDay = current.kwh / current.days;
  const z = (actualPerDay - expectedPerDay) / fit.sigma;
  const expectedKwh = expectedPerDay * current.days;
  const residualKwh = current.kwh - expectedKwh;
  const flagged = z >= Z_FLAG;
  return {
    expectedPerDay,
    actualPerDay,
    expectedKwh,
    residualKwh,
    z,
    percentile: normalCdf(z) * 100,
    flagged,
    low: z <= -Z_FLAG,
    potentialExcessKwh: flagged ? residualKwh : 0,
    fit,
  };
}
