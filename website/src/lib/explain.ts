// Plain-language explanation of a result. Everything under "facts" is computed
// from the reading, the model inputs and the model's own per-input contributions.
// "Possible explanations" are clearly framed as things to consider: WATTWISE
// cannot see devices or people, so it never states a cause.

import type { ModelInputs } from "./ml/gbm";
import { fmtEnergy } from "./units";

export const INPUT_INFO: Record<keyof ModelInputs, { label: string; intervals: number; period: string }> = {
  previous_interval: { label: "Previous 10 minutes", intervals: 1, period: "previous 10 minutes" },
  rolling_1h_mean: { label: "Last hour", intervals: 6, period: "last hour" },
  rolling_6h_mean: { label: "Last 6 hours", intervals: 36, period: "last 6 hours" },
};

/** "500 Wh total (83.3 Wh per 10 min)" — inputs shown the way people think about them. */
export function describeInput(key: keyof ModelInputs, avgPerInterval: number) {
  const info = INPUT_INFO[key];
  if (info.intervals === 1) return `${fmtEnergy(avgPerInterval)}`;
  return `${fmtEnergy(avgPerInterval * info.intervals)} total · ${fmtEnergy(avgPerInterval)} per 10 min`;
}

type Input = {
  actualWh: number;
  inputs: ModelInputs;
  result: { expectedWh: number; residualWh: number; flagged: boolean; thresholdWh: number; outOfRange: string[] };
  explanation?: { base: number; contributions: Record<string, number> };
  /** reading is in the bottom 5% of validation residuals */
  low?: boolean;
};

function ratioPhrase(actual: number, ref: number, what: string) {
  if (ref <= 0) return null;
  const r = actual / ref;
  if (r >= 1.5) return `${r.toFixed(1)}× the ${what} average (${fmtEnergy(ref)} per 10 min)`;
  if (r <= 0.67) return `${Math.round((1 - r) * 100)}% below the ${what} average (${fmtEnergy(ref)} per 10 min)`;
  return `close to the ${what} average (${fmtEnergy(ref)} per 10 min)`;
}

export function explainResult(a: Input) {
  const { actualWh, inputs, result: r } = a;
  const facts: string[] = [];
  const diff = Math.abs(r.residualWh);

  // 1. the verdict, in numbers
  if (r.flagged)
    facts.push(
      `This reading used ${fmtEnergy(diff)} more than expected. That is above the flag line of ${fmtEnergy(r.thresholdWh)}, which only the top 5% of surprises in the validation data reached.`,
    );
  else if (r.residualWh >= 0)
    facts.push(`This reading used ${fmtEnergy(diff)} more than expected, which is below the ${fmtEnergy(r.thresholdWh)} flag line, so it counts as normal variation.`);
  else if (a.low) facts.push(`This reading used ${fmtEnergy(diff)} less than expected, lower than 95% of intervals in the validation data.`);
  else facts.push(`This reading used ${fmtEnergy(diff)} less than expected, which is normal variation.`);

  // 2. how the reading compares with the recent context the model used
  const prev = inputs.previous_interval;
  if (prev > 0) {
    const ratio = actualWh / prev;
    if (ratio >= 1.5) facts.push(`Use jumped from ${fmtEnergy(prev)} in the previous 10 minutes to ${fmtEnergy(actualWh)} (${ratio.toFixed(1)}×).`);
    else if (ratio <= 0.67) facts.push(`Use dropped from ${fmtEnergy(prev)} in the previous 10 minutes to ${fmtEnergy(actualWh)} (${Math.round((1 - ratio) * 100)}% lower).`);
    else facts.push(`Use was similar to the previous 10 minutes (${fmtEnergy(prev)}).`);
  }
  const h1 = ratioPhrase(actualWh, inputs.rolling_1h_mean, "last-hour");
  const h6 = ratioPhrase(actualWh, inputs.rolling_6h_mean, "6-hour");
  if (h1 && h6) facts.push(`It was ${h1}, and ${h6}.`);

  // 3. what drove the expectation (from the model's own path contributions)
  let driver: string | null = null;
  if (a.explanation) {
    const entries = Object.entries(a.explanation.contributions) as [keyof ModelInputs, number][];
    const [key, value] = entries.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
    driver = `The expectation of ${fmtEnergy(r.expectedWh)} was driven mostly by the ${INPUT_INFO[key].period} (${value >= 0 ? "+" : "−"}${fmtEnergy(
      Math.abs(value),
    )} compared with a typical interval).`;
    facts.push(driver);
  }

  // 4. reliability
  if (r.outOfRange.length)
    facts.push(
      `Some recent-context values are outside what the model saw in training (${r.outOfRange
        .map((f) => INPUT_INFO[f as keyof ModelInputs]?.period ?? f)
        .join(", ")}), so treat this expectation with caution. Check that hour and 6-hour values are totals for those periods.`,
    );

  const possible =
    r.residualWh >= 0
      ? r.flagged
        ? [
            "A high-power appliance switched on (for example an oven, heater, kettle, washer or dryer).",
            "More people or activity than usual for this time.",
            "Equipment left running or running longer than usual.",
          ]
        : ["Normal ups and downs in use. Nothing here stands out from typical variation."]
      : !a.low
        ? ["Normal ups and downs in use. Nothing here stands out from typical variation."]
        : [
          "A high-use period (cooking, laundry, heating) had just ended.",
          "Appliances were switched off, or fewer people were around.",
          "The recent context may overstate typical use. Hour and 6-hour values should be totals for those periods.",
        ];

  return { facts, possible };
}
