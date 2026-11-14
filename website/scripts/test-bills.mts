// Self-check for the bill model (src/lib/ml/bills.ts). Run: npm run test:bills
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyseBill, fitBills, normalCdf, daysInMonth, PRIOR_CV, PRIOR_WEIGHT, type Bill } from "../src/lib/ml/bills.ts";

const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const bill = (month: string, kwh: number, days = daysInMonth(month)): Bill => ({ month, kwh, days });

// normal CDF reference values
close(normalCdf(0), 0.5, 1e-7);
close(normalCdf(2), 0.97724987, 1e-6);
close(normalCdf(-1), 0.15865525, 1e-6);

// ---- average model: 10, 12, 14 kWh/day. Shrunk variance + prediction-interval widening.
const h = [bill("2026-04", 300, 30), bill("2026-06", 360, 30), bill("2026-09", 420, 30)];
const f = fitBills(h, "2026-10");
assert.equal(f.method, "average");
close(f.meanPerDay, 12);
const varAvg = (PRIOR_WEIGHT * (PRIOR_CV * 12) ** 2 + 8) / (PRIOR_WEIGHT + 2); // sse = 4+0+4
close(f.sigma, Math.sqrt(varAvg * (1 + 1 / 3)));
let r = analyseBill(h, bill("2026-10", 31 * 16));
close(r.expectedPerDay, 12);
close(r.z, 4 / f.sigma);
assert.equal(r.flagged, true);
close(r.potentialExcessKwh, 31 * 4);
r = analyseBill(h, bill("2026-10", 31 * 13)); // +1/day: normal
assert.equal(r.flagged, false);
assert.equal(r.potentialExcessKwh, 0);
r = analyseBill(h, bill("2026-10", 31 * 7)); // −5/day: much lower
assert.equal(r.low, true);

// ---- identical past bills: no longer a hard floor; the prior keeps small changes normal
const same = [bill("2026-01", 310, 31), bill("2026-02", 280, 28), bill("2026-03", 310, 31)]; // 10/day each
const fs0 = fitBills(same, "2026-04");
close(fs0.sigma, Math.sqrt(((PRIOR_WEIGHT * 1) / (PRIOR_WEIGHT + 2)) * (1 + 1 / 3))); // prior var = (0.1*10)^2 = 1
assert.equal(analyseBill(same, bill("2026-04", 30 * 10.5, 30)).flagged, false); // +5% is normal
assert.equal(analyseBill(same, bill("2026-04", 30 * 13, 30)).flagged, true); // +30% is unusual

// ---- trend model: perfect line 10 + 1/day per month
const t = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((m, i) => bill(m, (10 + i) * 30, 30));
const ft = fitBills(t, "2026-07");
assert.equal(ft.method, "trend");
close(ft.slope, 1);
r = analyseBill(t, bill("2026-07", 16 * 31));
close(r.expectedPerDay, 16);
close(r.z, 0);

// ---- seasonal: strong summer peak; 2 years of history. Summer should be normal, not flagged.
const season = (mo: number) => 10 + 6 * Math.max(0, Math.cos(((mo - 7) / 12) * 2 * Math.PI)); // peak in July
const months: string[] = [];
for (let i = 0; i < 18; i++) months.push(`${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`); // 2025-01 .. 2026-06
const hs = months.map((m) => bill(m, season(Number(m.slice(5))) * 30, 30));
const july = bill("2026-07", season(7) * 31, 31);
const avgOnly = analyseBill(hs.filter((b) => b.month >= "2026-01" && b.month <= "2026-03"), july); // winter-only history, no year-ago month
assert.notEqual(avgOnly.fit.method, "seasonal");
assert.equal(avgOnly.flagged, true, "without seasonality a normal summer looks unusual");
const rs = analyseBill(hs, july);
assert.equal(rs.fit.method, "seasonal");
assert.equal(rs.fit.seasonal?.month, "2025-07");
assert.equal(rs.fit.seasonal?.levelMonths, 3); // Apr–Jun compared with Apr–Jun a year earlier
close(rs.expectedPerDay, season(7), 1e-9); // same level both years → ratio 1
assert.equal(rs.flagged, false, "with last July known, a normal summer is normal");
// a summer that's genuinely 40% above last year (and recent months unchanged) is flagged
assert.equal(analyseBill(hs, bill("2026-07", season(7) * 1.4 * 31, 31)).flagged, true);
// level change: if recent months are 20% higher than a year ago, expectation scales up
const hs2 = hs.map((b) => (b.month >= "2026-04" ? { ...b, kwh: b.kwh * 1.2 } : b));
close(analyseBill(hs2, july).expectedPerDay, season(7) * 1.2, 1e-9);

// ---- guards
assert.throws(() => fitBills(h.slice(0, 2)));
assert.throws(() => analyseBill(h, bill("2026-09", 100)));

// ---- real example bills: Jan–Apr 2016 history, May 2016 current
const demo: Bill[] = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/data/demo-bills.json"), "utf8"));
const d = analyseBill(demo.slice(0, 4), demo[4]);
console.log(
  `demo May 2016: ${d.actualPerDay.toFixed(2)} kWh/day vs expected ${d.expectedPerDay.toFixed(2)} (σ ${d.fit.sigma.toFixed(2)}, z ${d.z.toFixed(2)}, ${d.flagged ? "unusual" : d.low ? "much lower" : "normal"})`,
);
console.log("All bill-model checks passed.");
