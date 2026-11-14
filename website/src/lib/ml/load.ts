import type { ModelJson } from "./gbm";

// The exported model (~230 KB) is code-split and fetched only when an analysis
// runs, then cached for the rest of the session.
let cached: Promise<ModelJson> | null = null;

export function loadModel(): Promise<ModelJson> {
  cached ??= import("@/data/wattwise-model.json").then((m) => (m.default ?? m) as unknown as ModelJson);
  return cached;
}

export type GoldenCase = {
  timestamp: string;
  actualWh: number;
  history: number[];
  pythonFeatures: Record<string, number>;
  pythonExpectedWh: number;
  pythonResidualWh: number;
  pythonPercentile: number;
  pythonFlagged: boolean;
};

export async function loadGolden(): Promise<{ tolerance: { expectedWh: number }; cases: GoldenCase[] }> {
  const m = await import("@/data/golden.json");
  return (m.default ?? m) as unknown as { tolerance: { expectedWh: number }; cases: GoldenCase[] };
}
