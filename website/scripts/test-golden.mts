// Golden tests: the browser inference code (src/lib/ml/gbm.ts) must reproduce the
// Python model exactly. Raw 36-reading history -> features -> prediction -> percentile.
//
// Run:  npm run test:golden

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyse, inputsFromHistory, type ModelJson } from "../src/lib/ml/gbm.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(here, "../src/data", f), "utf8"));
const model: ModelJson = read("wattwise-model.json");
const golden = read("golden.json");

let failed = 0;
let maxPredDiff = 0;
let maxFeatDiff = 0;
console.log(`Model: ${model.modelName}, ${model.trees.length} trees. Cases: ${golden.cases.length}\n`);
console.log("timestamp          actual   python expected   browser expected   |diff|      pct(py/js)   flag");

for (const c of golden.cases) {
  const inputs = inputsFromHistory(c.history, model.historyIntervals);
  if (!inputs) {
    console.log(`FAIL ${c.timestamp}: could not derive inputs`);
    failed++;
    continue;
  }
  for (const f of model.features) {
    const d = Math.abs(inputs[f as keyof typeof inputs] - c.pythonFeatures[f]);
    maxFeatDiff = Math.max(maxFeatDiff, d);
    if (d > golden.tolerance.featureWh) {
      console.log(`FAIL ${c.timestamp}: feature ${f} js=${inputs[f as keyof typeof inputs]} py=${c.pythonFeatures[f]}`);
      failed++;
    }
  }
  const r = analyse(model, c.actualWh, inputs);
  const diff = Math.abs(r.expectedWh - c.pythonExpectedWh);
  maxPredDiff = Math.max(maxPredDiff, diff);
  // explanation must add up to the prediction; position must match Python
  const explained = r.explanation.base + Object.values(r.explanation.contributions).reduce((s, v) => s + v, 0);
  const explainOk = Math.abs(explained - r.expectedWh) < 1e-6;
  const positionOk = c.pythonPosition === undefined || (r.position !== null && Math.abs(r.position - c.pythonPosition) < 1e-9);
  if (!explainOk) console.log(`FAIL ${c.timestamp}: explanation sums to ${explained}, prediction ${r.expectedWh}`);
  if (!positionOk) console.log(`FAIL ${c.timestamp}: position js=${r.position} py=${c.pythonPosition}`);
  const ok =
    diff <= golden.tolerance.expectedWh &&
    Math.abs(r.percentile - c.pythonPercentile) < 1e-9 &&
    r.flagged === c.pythonFlagged &&
    explainOk &&
    positionOk;
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${c.timestamp}  ${c.actualWh.toFixed(0).padStart(5)}   ${c.pythonExpectedWh.toFixed(6).padStart(14)}   ${r.expectedWh
      .toFixed(6)
      .padStart(16)}   ${diff.toExponential(1).padStart(8)}   ${c.pythonPercentile.toFixed(2).padStart(5)}/${r.percentile
      .toFixed(2)
      .padEnd(6)}  ${r.flagged ? "Y" : "n"}`,
  );
}

console.log(`\nmax |prediction diff| = ${maxPredDiff.toExponential(2)} Wh, max |feature diff| = ${maxFeatDiff.toExponential(2)} Wh`);
console.log(failed ? `\n${failed} FAILED` : `\nAll ${golden.cases.length} golden cases passed.`);
process.exit(failed ? 1 : 0);
