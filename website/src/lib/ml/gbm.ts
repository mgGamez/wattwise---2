// WATTWISE in-browser inference: an exact re-implementation of scikit-learn's
// GradientBoostingRegressor.predict for the exported model (ml/export_web.py).
//
//   prediction = init + Σ_trees learningRate × leafValue(tree, x)
//
// scikit-learn casts inputs to float32 before walking the trees and compares
// them with float64 thresholds ("go left if x <= threshold"). We do the same
// with Math.fround, and add tree contributions in the same order, so results
// match Python to floating-point rounding (verified by scripts/test-golden.mts).
//
// This file has no imports so it can be run directly by Node for golden tests.

export type Tree = {
  left: number[];
  right: number[];
  feature: number[];
  threshold: number[];
  value: number[];
};

export type ModelJson = {
  format: string;
  modelName: string;
  params: Record<string, unknown>;
  features: string[];
  featureDefinitions: Record<string, { label: string; rule: string }>;
  historyIntervals: number;
  intervalMinutes: number;
  units: string;
  inputDtype: string;
  init: number;
  learningRate: number;
  trees: Tree[];
  trainingRange: Record<string, [number, number]>;
  calibration: { rule: string; thresholdWh: number; referencePositiveResiduals: number[] };
  trainedOn: [string, string];
};

/** The three model inputs, in Wh per 10-minute interval. */
export type ModelInputs = {
  previous_interval: number;
  rolling_1h_mean: number;
  rolling_6h_mean: number;
};

export type Inference = {
  inputs: ModelInputs;
  expectedWh: number;
  residualWh: number;
  percentile: number;
  flagged: boolean;
  thresholdWh: number;
  outOfRange: string[];
  treesEvaluated: number;
};

function leafValue(tree: Tree, x: number[]): number {
  let node = 0;
  while (tree.left[node] !== -1) {
    const v = Math.fround(x[tree.feature[node]]);
    node = v <= tree.threshold[node] ? tree.left[node] : tree.right[node];
  }
  return tree.value[node];
}

/** Raw model prediction (expected Wh for the interval). */
export function predict(model: ModelJson, inputs: ModelInputs): number {
  const x = model.features.map((f) => {
    const v = inputs[f as keyof ModelInputs];
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`Missing model input: ${f}`);
    return v;
  });
  let raw = model.init;
  for (const tree of model.trees) raw += model.learningRate * leafValue(tree, x);
  return raw;
}

/**
 * Derive the model inputs from the 36 readings immediately before the analysed
 * interval (oldest first). Mirrors ml/features.py:
 *   previous_interval = reading at t-10 min
 *   rolling_1h_mean   = mean of the 6 readings before t
 *   rolling_6h_mean   = mean of the 36 readings before t
 * Returns null if the history is incomplete — missing values are never invented.
 */
export function inputsFromHistory(history: (number | null | undefined)[], intervals = 36): ModelInputs | null {
  if (history.length !== intervals) return null;
  if (history.some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0)) return null;
  const h = history as number[];
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  return {
    previous_interval: h[h.length - 1],
    rolling_1h_mean: mean(h.slice(-6)),
    rolling_6h_mean: mean(h),
  };
}

/** Same as Python: searchsorted(ref, residual, side="right") / len(ref) * 100; 0 when residual <= 0. */
export function anomalyPercentile(model: ModelJson, residual: number): number {
  if (!(residual > 0)) return 0;
  const ref = model.calibration.referencePositiveResiduals;
  let lo = 0;
  let hi = ref.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (ref[mid] <= residual) lo = mid + 1;
    else hi = mid;
  }
  return (lo / ref.length) * 100;
}

/** Full analysis of one interval. */
export function analyse(model: ModelJson, actualWh: number, inputs: ModelInputs): Inference {
  if (!Number.isFinite(actualWh) || actualWh < 0) throw new Error("Actual reading must be a non-negative number");
  const expectedWh = predict(model, inputs);
  const residualWh = actualWh - expectedWh;
  const thresholdWh = model.calibration.thresholdWh;
  const outOfRange = model.features.filter((f) => {
    const [lo, hi] = model.trainingRange[f];
    const v = inputs[f as keyof ModelInputs];
    return v < lo || v > hi;
  });
  return {
    inputs,
    expectedWh,
    residualWh,
    percentile: anomalyPercentile(model, residualWh),
    flagged: residualWh >= thresholdWh,
    thresholdWh,
    outOfRange,
    treesEvaluated: model.trees.length,
  };
}
