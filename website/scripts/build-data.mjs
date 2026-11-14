// Build-time data step: converts the REAL ML outputs in ../results into one
// frontend-friendly JSON file (src/data/site-data.json).
//
// Nothing here invents numbers. Every value is read from, or computed directly
// from, results/metrics.json, predictions.csv, anomalies.csv, failure_analysis.csv.
// If a file is missing, the related section is set to null and the page shows a
// "data unavailable" notice instead of crashing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Override with WATTWISE_RESULTS=/path/to/results if the outputs live elsewhere.
const RESULTS = path.resolve(process.env.WATTWISE_RESULTS ?? path.join(here, "../../results"));
const OUT = path.resolve(here, "../src/data/site-data.json");

const INTERVALS_PER_HOUR = 6;
const CHART_WINDOW = 72 * INTERVALS_PER_HOUR; // 72 hours of 10-minute intervals
const CONTEXT = 12; // ±2 hours around an anomaly (mini charts)
const HERO_CONTEXT = 18; // ±3 hours around the featured anomaly

const status = {};
const warnings = [];

function readText(name) {
  const file = path.join(RESULTS, name);
  if (!fs.existsSync(file)) {
    status[name] = "missing";
    warnings.push(`${name} not found in ${RESULTS}`);
    return null;
  }
  status[name] = "ok";
  return fs.readFileSync(file, "utf8");
}

// Small CSV parser (handles quoted fields).
function parseCsv(text) {
  if (!text) return null;
  const rows = [];
  let field = "", row = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const num = (v) => (v === undefined || v === "" ? null : Number(v));
const bool = (v) => v === "True" || v === "true";
const round = (v, d = 2) => (v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d);

// ---------------------------------------------------------------- load
const metricsText = readText("metrics.json");
const metrics = metricsText ? JSON.parse(metricsText) : null;
const predictions = parseCsv(readText("predictions.csv"))?.map((r) => ({
  t: r.timestamp,
  actual: num(r.actual_wh),
  expected: num(r.predicted_wh),
  baseline: num(r.baseline_wh),
  residual: num(r.residual_wh),
  pctAbove: num(r.pct_above_prediction),
  percentile: num(r.anomaly_percentile),
  flagged: bool(r.is_anomaly),
})) ?? null;
const anomalyRows = parseCsv(readText("anomalies.csv"));
const failureRows = parseCsv(readText("failure_analysis.csv"));

// ---------------------------------------------------------------- metrics
let model = null;
if (metrics) {
  const vc = metrics.validation_model_comparison;
  const selectedName = metrics.selected_model.name;
  const order = ["Baseline", "Linear Regression", "Random Forest", "Gradient Boosting"];
  const fb = metrics.final_test_baseline;
  const fm = metrics.final_test_selected_model;
  const improvementMae = round((100 * (fb.MAE_wh - fm.MAE_wh)) / fb.MAE_wh, 1);
  const improvementRmse = round((100 * (fb.RMSE_wh - fm.RMSE_wh)) / fb.RMSE_wh, 1);
  const reported = metrics.percentage_improvement_over_baseline;
  if (reported && (reported.MAE_pct !== improvementMae || reported.RMSE_pct !== improvementRmse)) {
    warnings.push(`Improvement mismatch: computed ${improvementMae}/${improvementRmse}, metrics.json ${reported.MAE_pct}/${reported.RMSE_pct}`);
  }
  model = {
    dataset: metrics.dataset,
    split: metrics.split,
    periods: {
      train: metrics.train_period,
      validation: metrics.validation_period,
      test: metrics.test_period,
    },
    validation: order
      .filter((n) => vc[n])
      .map((n) => ({
        name: n,
        mae: vc[n].validation.MAE_wh,
        rmse: vc[n].validation.RMSE_wh,
        features: vc[n].features ?? null,
        selected: n === selectedName,
      })),
    selected: {
      name: selectedName,
      features: metrics.selected_model.features,
      params: metrics.selected_model.params,
      rule: metrics.selected_model.selection_rule,
    },
    finalTest: {
      baseline: { mae: fb.MAE_wh, rmse: fb.RMSE_wh },
      model: { mae: fm.MAE_wh, rmse: fm.RMSE_wh },
      improvement: { mae: improvementMae, rmse: improvementRmse },
    },
    persistence: metrics.reference_copy_previous_interval_no_ML
      ? {
          validation: { mae: metrics.reference_copy_previous_interval_no_ML.validation.MAE_wh, rmse: metrics.reference_copy_previous_interval_no_ML.validation.RMSE_wh },
          test: { mae: metrics.reference_copy_previous_interval_no_ML.final_test.MAE_wh, rmse: metrics.reference_copy_previous_interval_no_ML.final_test.RMSE_wh },
        }
      : null,
    anomalyMethod: {
      thresholdWh: metrics.anomaly_methodology.threshold_wh,
      rule: metrics.anomaly_methodology.threshold_rule,
      validationPositive: metrics.anomaly_methodology.validation_positive_residuals,
      flagged: metrics.anomaly_methodology.final_test_flagged_intervals,
      periods: metrics.anomaly_methodology.final_test_flagged_periods,
      injection: metrics.anomaly_methodology.injection_diagnostic ?? null,
    },
    featureImportance: metrics.selected_model_feature_importances
      ? Object.entries(metrics.selected_model_feature_importances)
          .map(([feature, importance]) => ({ feature, importance }))
          .sort((a, b) => b.importance - a.importance)
      : null,
    candidateFeatures: metrics.candidate_features
      ? {
          // Every candidate tested by forward selection; "kept" = chosen on validation.
          all: metrics.candidate_features,
          kept: metrics.selected_model.features,
        }
      : null,
    leakageCheckPassed: metrics.tree_model_investigation?.leakage_check?.passed ?? null,
  };
}

// ---------------------------------------------------------------- predictions-derived
const indexOf = new Map(predictions?.map((p, i) => [p.t, i]) ?? []);
const slim = (p) => ({ t: p.t, actual: p.actual, expected: p.expected, flagged: p.flagged });
const around = (t, k) => {
  const i = indexOf.get(t);
  if (i === undefined) return [];
  return predictions.slice(Math.max(0, i - k), i + k + 1).map(slim);
};

let anomalies = null;
if (anomalyRows) {
  anomalies = anomalyRows.map((r) => ({
    t: r.timestamp,
    actual: num(r.actual_wh),
    expected: num(r.predicted_wh),
    residual: num(r.residual_wh),
    pctAbove: num(r.pct_above_prediction),
    percentile: num(r.anomaly_percentile),
    periodId: num(r.period_id),
    context: predictions ? around(r.timestamp, CONTEXT) : [],
  }));
}

// Featured anomaly: the largest residual (the same quantity the detector ranks by).
const hero = anomalies?.length
  ? (() => {
      const a = anomalies.reduce((best, x) => (x.residual > best.residual ? x : best));
      return { ...a, context: predictions ? around(a.t, HERO_CONTEXT) : [] };
    })()
  : null;

// Chart window: the 72-hour stretch of the test period containing the most flagged intervals.
let chart = null;
if (predictions && predictions.length >= CHART_WINDOW) {
  let count = 0, best = -1, bestStart = 0;
  for (let i = 0; i < predictions.length; i++) {
    count += predictions[i].flagged ? 1 : 0;
    if (i >= CHART_WINDOW) count -= predictions[i - CHART_WINDOW].flagged ? 1 : 0;
    if (i >= CHART_WINDOW - 1 && count > best) { best = count; bestStart = i - CHART_WINDOW + 1; }
  }
  const pts = predictions.slice(bestStart, bestStart + CHART_WINDOW);
  chart = {
    rule: "72-hour window of the final test period with the most flagged intervals",
    start: pts[0].t,
    end: pts.at(-1).t,
    flaggedInWindow: best,
    points: pts.map(slim),
  };
}

// Context matters.
let context = null;
if (predictions && model) {
  const threshold = model.anomalyMethod.thresholdWh;
  const normalBand = 0.3 * threshold;
  const highButNormal = predictions
    .filter((p) => !p.flagged && Math.abs(p.residual) <= normalBand)
    .reduce((best, p) => (!best || p.actual > best.actual ? p : best), null);
  const flagged = predictions.filter((p) => p.flagged);
  const lowButUnusual = flagged.reduce(
    (best, p) => (!best || p.actual < best.actual || (p.actual === best.actual && p.residual > best.residual) ? p : best),
    null,
  );
  // A naive "highest usage" rule that flags the same number of intervals as WATTWISE.
  const n = flagged.length;
  const topByUsage = [...predictions].sort((a, b) => b.actual - a.actual || a.t.localeCompare(b.t)).slice(0, n);
  const overlap = topByUsage.filter((p) => p.flagged).length;
  context = {
    highButNormal: highButNormal && {
      ...highButNormal,
      rule: `highest-usage interval not flagged, with |residual| ≤ 30% of the threshold`,
      context: around(highButNormal.t, CONTEXT),
    },
    lowButUnusual: lowButUnusual && {
      ...lowButUnusual,
      rule: "lowest-usage interval that WATTWISE flagged",
      context: around(lowButUnusual.t, CONTEXT),
    },
    usageRule: {
      n,
      overlap,
      minUsageInRule: topByUsage.at(-1)?.actual ?? null,
      explanation: `Ranking the ${n} highest-usage test intervals and comparing them with the ${n} WATTWISE flags.`,
    },
  };
}

// Failure lab: largest under-prediction that is not the featured anomaly + the two largest over-predictions.
let failures = null;
if (failureRows) {
  const rows = failureRows.map((r) => ({
    t: r.timestamp,
    day: r.day,
    expected: num(r.predicted_wh),
    actual: num(r.actual_wh),
    error: num(r.error_wh),
    absError: num(r.absolute_error_wh),
    direction: r.direction,
    flagged: bool(r.flagged_as_anomaly),
    previousInterval: num(r.previous_interval),
    context: predictions ? around(r.timestamp, CONTEXT) : [],
  }));
  const under = rows.filter((r) => r.error > 0).sort((a, b) => b.absError - a.absError);
  const over = rows.filter((r) => r.error < 0).sort((a, b) => b.absError - a.absError);
  const pickUnder = under.find((r) => r.t !== hero?.t) ?? under[0];
  failures = [pickUnder, ...over.slice(0, 2)].filter(Boolean);
}

// Hero background line: real actual consumption, 72 hours centred on the featured anomaly.
let heroLine = null;
if (predictions && hero) {
  const i = indexOf.get(hero.t);
  const start = Math.max(0, Math.min(i - CHART_WINDOW / 2, predictions.length - CHART_WINDOW));
  const slice = predictions.slice(start, start + CHART_WINDOW);
  heroLine = { values: slice.map((p) => p.actual), focusIndex: i - start, start: slice[0].t, end: slice.at(-1).t };
}

// Only what the app's Learn page needs (research facts, two context observations,
// three failure cases). Bulk arrays stay out of the client bundle.
const strip = ({ context: _c, ...rest }) => rest;
const site = {
  generatedAt: new Date().toISOString(),
  sources: status,
  warnings,
  model,
  context: context && {
    highButNormal: context.highButNormal && strip(context.highButNormal),
    lowButUnusual: context.lowButUnusual && strip(context.lowButUnusual),
    usageRule: context.usageRule,
  },
  failures: failures && failures.map(strip),
  anomalyCount: anomalies ? anomalies.length : null,
};
void hero; void heroLine; void chart;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(site));
console.log(`[wattwise] wrote ${path.relative(process.cwd(), OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
for (const [f, s] of Object.entries(status)) console.log(`  ${s === "ok" ? "✓" : "✗"} ${f}`);
for (const w of warnings) console.warn(`  ! ${w}`);
