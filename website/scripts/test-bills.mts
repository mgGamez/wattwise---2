// Self-check for the bill model (src/lib/ml/bills.ts). Run: npm run test:bills
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyseBill, fitBills, normalCdf, daysInMonth, type Bill } from "../src/lib/ml/bills.ts";

const close = (a: number, b: number, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);
const bill = (month: string, kwh: number, days = daysInMonth(month)): Bill => ({ month, kwh, days });

// normal CDF reference values
close(normalCdf(0), 0.5, 1e-7);
close(normalCdf(2), 0.97724987, 1e-6);
close(normalCdf(-1), 0.15865525, 1e-6);

// average model: 3 months at exactly 10, 12, 14 kWh/day (30-day months)
const h = [bill("2026-04", 300, 30), bill("2026-06", 360, 30), bill("2026-09", 420, 30)];
const f = fitBills(h);
assert.equal(f.method, "average");
close(f.meanPerDay, 12);
close(f.sigma, 2); // sample sd of 10,12,14
let r = analyseBill(h, bill("2026-10", 31 * 16)); // 16/day -> z = 2 -> flagged
close(r.expectedPerDay, 12);
close(r.z, 2);
assert.equal(r.flagged, true);
close(r.residualKwh, 31 * 4);
close(r.potentialExcessKwh, 31 * 4);
r = analyseBill(h, bill("2026-10", 31 * 12.5)); // normal
assert.equal(r.flagged, false);
assert.equal(r.potentialExcessKwh, 0);
r = analyseBill(h, bill("2026-10", 31 * 7)); // z = -2.5 -> much lower
assert.equal(r.low, true);

// trend model: perfect line 10 + 1/day per month over 6 months, sd floored at 5% of mean
const t = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map((m, i) => bill(m, (10 + i) * 30, 30));
const ft = fitBills(t);
assert.equal(ft.method, "trend");
close(ft.slope, 1);
close(ft.sigma, 0.05 * 12.5);
r = analyseBill(t, bill("2026-07", 16 * 31));
close(r.expectedPerDay, 16);
close(r.z, 0);

// guards
assert.throws(() => fitBills(h.slice(0, 2)));
assert.throws(() => analyseBill(h, bill("2026-09", 100)));

// real demo bills: Jan–Apr 2016 history, May 2016 current
const demo: Bill[] = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/data/demo-bills.json"), "utf8"));
const d = analyseBill(demo.slice(0, 4), demo[4]);
console.log(
  `demo May 2016: ${d.actualPerDay.toFixed(2)} kWh/day vs expected ${d.expectedPerDay.toFixed(2)} (σ ${d.fit.sigma.toFixed(2)}, z ${d.z.toFixed(2)}, ${d.flagged ? "unusual" : d.low ? "much lower" : "normal"})`,
);
console.log("All bill-model checks passed.");
