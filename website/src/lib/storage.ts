"use client";

// The ONE persistence layer for WATTWISE. Everything the app remembers lives in a
// single versioned localStorage document. Components read it with useAppState()
// and change it only through the mutators below.

import { useSyncExternalStore } from "react";
import type { Bill, BillFit } from "./ml/bills";

export const STORAGE_KEY = "wattwise:v2";
const LEGACY_KEY = "wattwise:v1"; // 10-minute-reading era; profile/tariff/onboarding are migrated
export const SCHEMA_VERSION = 2 as const;

export type BuildingType = "home" | "apartment" | "office" | "small-business" | "other";
export type CurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AUD" | "CAD" | "SGD" | "AED";

export type ActionItem = {
  id: string;
  category: "cooling-heating" | "lighting" | "standby" | "high-load" | "timing";
  title: string;
  detail: string;
};

/** One analysed bill: the current month judged against the user's earlier months. */
export type Analysis = {
  id: string;
  createdAt: string; // ISO time the analysis was run
  month: string; // "YYYY-MM" of the bill analysed
  source: "manual" | "demo";
  current: Bill;
  history: Bill[];
  result: {
    expectedKwh: number;
    expectedPerDay: number;
    actualPerDay: number;
    residualKwh: number;
    z: number;
    percentile: number;
    flagged: boolean;
    low: boolean;
    /** residual counted as potential excess only when the bill is flagged as unusual */
    potentialExcessKwh: number;
    fit: BillFit;
  };
  actions: ActionItem[];
};

export type AppState = {
  version: typeof SCHEMA_VERSION;
  onboarding: { completed: boolean; completedAt: string | null };
  profile: { buildingType: BuildingType | null };
  tariff: { currency: CurrencyCode; perKwh: number } | null;
  preferences: { motion: "system" | "reduced" };
  analyses: Analysis[];
  /** analysisId -> actionId -> time it was marked as checked */
  actions: Record<string, Record<string, string>>;
  /** remembered bills, keyed by "YYYY-MM" — used to pre-fill history next time */
  bills: Record<string, { kwh: number; days: number }>;
};

export function freshState(): AppState {
  return {
    version: SCHEMA_VERSION,
    onboarding: { completed: false, completedAt: null },
    profile: { buildingType: null },
    tariff: null,
    preferences: { motion: "system" },
    analyses: [],
    actions: {},
    bills: {},
  };
}

// ---------------------------------------------------------------- validation
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}$/.test(v);

function isAnalysis(a: unknown): a is Analysis {
  if (!isObj(a) || !isObj(a.result) || !isObj(a.current)) return false;
  return (
    typeof a.id === "string" &&
    isMonth(a.month) &&
    isNum(a.current.kwh) &&
    Array.isArray(a.history) &&
    isNum(a.result.expectedKwh) &&
    isNum(a.result.residualKwh) &&
    Array.isArray(a.actions)
  );
}

/** Parse + sanitise whatever is in storage. Unknown/corrupt data never crashes the app. */
function parse(raw: string | null, legacy: string | null = null): AppState {
  const base = freshState();
  try {
    const d = raw ? JSON.parse(raw) : legacy ? JSON.parse(legacy) : null;
    if (!isObj(d) || (d.version !== SCHEMA_VERSION && d.version !== 1)) return base;
    const tariff = isObj(d.tariff) && isNum(d.tariff.perKwh) && typeof d.tariff.currency === "string" ? (d.tariff as AppState["tariff"]) : null;
    const common = {
      version: SCHEMA_VERSION,
      onboarding: isObj(d.onboarding)
        ? { completed: d.onboarding.completed === true, completedAt: (d.onboarding.completedAt as string) ?? null }
        : base.onboarding,
      profile: isObj(d.profile) ? { buildingType: (d.profile.buildingType as BuildingType) ?? null } : base.profile,
      tariff,
      preferences: { motion: isObj(d.preferences) && d.preferences.motion === "reduced" ? ("reduced" as const) : ("system" as const) },
    };
    // v1 held 10-minute analyses, which can't become bill analyses: keep only the setup.
    if (d.version === 1) return { ...base, ...common };
    return {
      ...common,
      analyses: Array.isArray(d.analyses) ? d.analyses.filter(isAnalysis) : [],
      actions: isObj(d.actions) ? (d.actions as AppState["actions"]) : {},
      bills: isObj(d.bills)
        ? Object.fromEntries(
            Object.entries(d.bills).filter(([k, v]) => isMonth(k) && isObj(v) && isNum(v.kwh) && isNum(v.days) && v.days > 0),
          ) as AppState["bills"]
        : {},
    };
  } catch {
    return base;
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
    const raw = window.localStorage.getItem(STORAGE_KEY);
    state = parse(raw, raw ? null : window.localStorage.getItem(LEGACY_KEY));
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

/** Save an analysis and remember every bill it used, so the next analysis is pre-filled. */
export function saveAnalysis(a: Analysis) {
  update((s) => {
    const bills = { ...s.bills };
    for (const b of [...a.history, a.current]) bills[b.month] = { kwh: b.kwh, days: b.days };
    return { ...s, analyses: [a, ...s.analyses.filter((x) => x.id !== a.id)], bills };
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
    window.localStorage.removeItem(LEGACY_KEY);
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
