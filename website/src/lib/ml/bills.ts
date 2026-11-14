// WATTWISE bill model: learns what's normal from the user's OWN past bills, in the
// browser, then judges the current bill against it. No imports, so Node can test it.
//
// Works in kWh per day so bills covering different numbers of days compare fairly.
//   < 6 past months : expected = mean daily use of past months
//   >= 6 past months: expected = least-squares trend line, extended to this month
// Typical variation = residual standard deviation of that fit.
// Unusual: this month is >= 2 standard deviations above expected (the usual
// statistical "far from normal" rule, about the top 2.5%); much lower: <= -2.

export type Bill = { month: string; kwh: number; days: number }; // month = "YYYY-MM"

export type BillFit = {
  method: "average" | "trend";
  n: number;
  intercept: number; // kWh/day at month index 0
  slope: number; // kWh/day change per month (0 for "average")
  sigma: number; // typical variation, kWh/day
  meanPerDay: number;
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

export const monthIndex = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return y * 12 + (mo - 1);
};

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

export function fitBills(history: Bill[]): BillFit {
  if (history.length < MIN_HISTORY) throw new Error(`Need at least ${MIN_HISTORY} past months`);
  const xs = history.map((b) => monthIndex(b.month));
  const ys = history.map((b) => b.kwh / b.days);
  const n = ys.length;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let intercept = meanY;
  let slope = 0;
  let method: BillFit["method"] = "average";
  if (n >= TREND_FROM) {
    const meanX = xs.reduce((s, v) => s + v, 0) / n;
    const sxx = xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
    if (sxx > 0) {
      slope = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0) / sxx;
      intercept = meanY - slope * meanX;
      method = "trend";
    }
  }
  const p = method === "trend" ? 2 : 1;
  const sse = ys.reduce((s, y, i) => s + (y - (intercept + slope * xs[i])) ** 2, 0);
  // shortcut: floor variation at 5% of typical daily use so identical past bills don't make every change "unusual"; replace with seasonal variance once 12+ months exist
  const sigma = Math.max(Math.sqrt(sse / (n - p)), 0.05 * meanY);
  return { method, n, intercept, slope, sigma, meanPerDay: meanY };
}

export function analyseBill(history: Bill[], current: Bill): BillResult {
  if (!(current.kwh >= 0) || !(current.days > 0)) throw new Error("Bill needs kWh ≥ 0 and days > 0");
  if (history.some((b) => b.month >= current.month)) throw new Error("History must be months before the bill being analysed");
  const fit = fitBills(history);
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
