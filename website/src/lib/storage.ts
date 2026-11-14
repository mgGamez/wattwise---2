"use client";

// The ONE persistence layer for WATTWISE. Everything the app remembers lives in a
// single versioned localStorage document. Components read it with useAppState()
// and change it only through the mutators below.

import { useSyncExternalStore } from "react";
import type { ModelInputs } from "./ml/gbm";

export const STORAGE_KEY = "wattwise:v1";
export const SCHEMA_VERSION = 1;
const MAX_READINGS = 6000; // cap on remembered 10-minute readings (~41 days)

export type BuildingType = "home" | "apartment" | "office" | "small-business" | "other";
export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AUD" | "CAD" | "SGD" | "AED";
export type ContextMethod = "saved-history" | "pasted-history" | "summary-values";

export type ActionItem = {
  id: string;
  category: "cooling-heating" | "lighting" | "standby" | "high-load" | "timing";
  title: string;
  detail: string;
};

export type Analysis = {
  id: string;
  createdAt: string; // ISO time the analysis was run
  timestamp: string; // local reading time "YYYY-MM-DDTHH:mm" (start of the 10-minute interval)
  source: "manual" | "demo";
  demoId?: string;
  actualWh: number;
  contextMethod: ContextMethod;
  inputs: ModelInputs;
  result: {
    expectedWh: number;
    residualWh: number;
    percentile: number;
    flagged: boolean;
    thresholdWh: number;
    /** residual counted as potential excess only when the reading is flagged as unusual */
    potentialExcessWh: number;
    outOfRange: string[];
  };
  model: { name: string; format: string; trees: number };
  actions: ActionItem[];
  pythonReference?: { expectedWh: number; percentile: number };
};

export type AppState = {
  version: typeof SCHEMA_VERSION;
  onboarding: { completed: boolean; completedAt: string | null };
  profile: { buildingType: BuildingType | null };
  tariff: { currency: CurrencyCode; perKwh: number } | null;
  preferences: { unit: "Wh" | "kWh"; motion: "system" | "reduced" };
  analyses: Analysis[];
  /** analysisId -> actionId -> time it was marked as checked */
  actions: Record<string, Record<string, string>>;
  /** remembered 10-minute readings (Wh), keyed by local "YYYY-MM-DDTHH:mm" */
  readings: Record<string, number>;
};

export function freshState(): AppState {
  return {
    version: SCHEMA_VERSION,
    onboarding: { completed: false, completedAt: null },
    profile: { buildingType: null },
    tariff: null,
    preferences: { unit: "Wh", motion: "system" },
    analyses: [],
    actions: {},
    readings: {},
  };
}

// ---------------------------------------------------------------- validation
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isAnalysis(a: unknown): a is Analysis {
  if (!isObj(a) || !isObj(a.result) || !isObj(a.inputs)) return false;
  return (
    typeof a.id === "string" &&
    typeof a.timestamp === "string" &&
    isNum(a.actualWh) &&
    isNum(a.result.expectedWh) &&
    isNum(a.result.residualWh) &&
    Array.isArray(a.actions)
  );
}

/** Parse + sanitise whatever is in storage. Unknown/corrupt data never crashes the app. */
function parse(raw: string | null): AppState {
  if (!raw) return freshState();
  try {
    const d = JSON.parse(raw);
    if (!isObj(d) || d.version !== SCHEMA_VERSION) return freshState();
    const base = freshState();
    const tariff = isObj(d.tariff) && isNum(d.tariff.perKwh) && typeof d.tariff.currency === "string" ? (d.tariff as AppState["tariff"]) : null;
    return {
      version: SCHEMA_VERSION,
      onboarding: isObj(d.onboarding)
        ? { completed: d.onboarding.completed === true, completedAt: (d.onboarding.completedAt as string) ?? null }
        : base.onboarding,
      profile: isObj(d.profile) ? { buildingType: (d.profile.buildingType as BuildingType) ?? null } : base.profile,
      tariff,
      preferences: isObj(d.preferences)
        ? {
            unit: d.preferences.unit === "kWh" ? "kWh" : "Wh",
            motion: d.preferences.motion === "reduced" ? "reduced" : "system",
          }
        : base.preferences,
      analyses: Array.isArray(d.analyses) ? d.analyses.filter(isAnalysis) : [],
      actions: isObj(d.actions) ? (d.actions as AppState["actions"]) : {},
      readings: isObj(d.readings)
        ? Object.fromEntries(Object.entries(d.readings).filter(([, v]) => isNum(v)) as [string, number][])
        : {},
    };
  } catch {
    return freshState();
  }
}

// ---------------------------------------------------------------- store
let state: AppState | null = null;
let storageError: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function load(): AppState {
  if (state) return state;
  try {
    state = parse(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    storageError = "This browser blocked local storage, so changes will be lost when the page closes.";
    state = freshState();
  }
  return state;
}

function persist(next: AppState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    storageError = null;
  } catch {
    storageError = "Couldn’t save to local storage (it may be full or blocked). Your latest change is only kept until you close the page.";
  }
  emit();
}

export function update(fn: (s: AppState) => AppState) {
  persist(fn(load()));
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      state = parse(e.newValue);
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Current state, or null during pre-rendering / before hydration. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(
    subscribe,
    () => load(),
    () => null,
  );
}

export function getStorageError() {
  return storageError;
}

// ---------------------------------------------------------------- mutators
export const completeOnboarding = (buildingType: BuildingType, tariff: NonNullable<AppState["tariff"]>) =>
  update((s) => ({
    ...s,
    profile: { buildingType },
    tariff,
    onboarding: { completed: true, completedAt: new Date().toISOString() },
  }));

export const setProfile = (buildingType: BuildingType) => update((s) => ({ ...s, profile: { buildingType } }));
export const setTariff = (tariff: NonNullable<AppState["tariff"]>) => update((s) => ({ ...s, tariff }));
export const setPreferences = (p: Partial<AppState["preferences"]>) =>
  update((s) => ({ ...s, preferences: { ...s.preferences, ...p } }));

/** Save an analysis and remember the readings it used (for future auto-derived history). */
export function saveAnalysis(a: Analysis, readings: Record<string, number>) {
  update((s) => {
    const merged = { ...s.readings, ...readings, [a.timestamp]: a.actualWh };
    const keys = Object.keys(merged).sort();
    const trimmed = keys.length > MAX_READINGS ? Object.fromEntries(keys.slice(-MAX_READINGS).map((k) => [k, merged[k]])) : merged;
    return { ...s, analyses: [a, ...s.analyses.filter((x) => x.id !== a.id)], readings: trimmed };
  });
}

export const deleteAnalysis = (id: string) =>
  update((s) => {
    const actions = { ...s.actions };
    delete actions[id];
    return { ...s, analyses: s.analyses.filter((a) => a.id !== id), actions };
  });

export const clearAnalyses = () => update((s) => ({ ...s, analyses: [], actions: {} }));

export const toggleAction = (analysisId: string, actionId: string) =>
  update((s) => {
    const forAnalysis = { ...(s.actions[analysisId] ?? {}) };
    if (forAnalysis[actionId]) delete forAnalysis[actionId];
    else forAnalysis[actionId] = new Date().toISOString();
    return { ...s, actions: { ...s.actions, [analysisId]: forAnalysis } };
  });

/** Remove every WATTWISE key from this browser and return to the first-run state. */
export function clearAllData() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  state = freshState();
  emit();
}

export function storageSizeBytes(): number {
  try {
    return (window.localStorage.getItem(STORAGE_KEY) ?? "").length * 2;
  } catch {
    return 0;
  }
}
