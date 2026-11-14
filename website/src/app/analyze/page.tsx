"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ResultView, type ResultData } from "@/components/result";
import { IconArrowRight, IconBolt, IconCheck, IconFlask } from "@/components/icons";
import { EASE, SPRING, useReduceMotion } from "@/components/motion";
import { Button, ButtonLink, PageHeader, PrivacyNote, Segmented } from "@/components/ui";
import { suggestActions } from "@/lib/actions";
import { analyse, inputsFromHistory, type ModelInputs } from "@/lib/ml/gbm";
import { loadDemos, loadModel, type DemoSample } from "@/lib/ml/load";
import { site } from "@/lib/data";
import { fmtNum } from "@/lib/money";
import { saveAnalysis, toggleAction, useAppState, type Analysis, type ContextMethod } from "@/lib/storage";
import { addMinutes, floorTo10, fmtInterval, fmtWhen, isValidLocal, nowLocal } from "@/lib/time";
import { fmtBoth, fmtEnergy, intervalFromTotal } from "@/lib/units";
import { UsageConverter } from "@/components/converter";

const HISTORY = 36;

function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

function parseList(text: string): (number | null)[] {
  return text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const v = Number(s);
      return Number.isFinite(v) ? v : null;
    });
}

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `a-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <Analyze />
    </Suspense>
  );
}

function Analyze() {
  const state = useAppState()!;
  const params = useSearchParams();
  const reduce = useReduceMotion();

  const [when, setWhen] = useState(() => floorTo10(nowLocal()));
  const [unit, setUnit] = useState<"Wh" | "kWh">(state.preferences.unit);
  const [actualText, setActualText] = useState("");
  const [mode, setMode] = useState<ContextMethod>("saved-history");
  const [pasteText, setPasteText] = useState("");
  // totals as people know them: the previous 10 minutes, the whole last hour, the whole last 6 hours
  const [summary, setSummary] = useState({ prev: "", h1: "", h6: "" });
  const [usage, setUsage] = useState<{ amount: string; period: "month" | "day" }>({ amount: "", period: "month" });
  const [demo, setDemo] = useState<DemoSample | null>(null);
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<(ResultData & { signature: string }) | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDemos, setShowDemos] = useState(false);
  const [demos, setDemos] = useState<DemoSample[] | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const scale = unit === "kWh" ? 1000 : 1;

  // ---- derived values
  const whenValid = isValidLocal(when);
  const actualRaw = parseNumber(actualText);
  const actualWh = actualRaw === null ? null : actualRaw * scale;
  const actualValid = actualWh !== null && actualWh >= 0 && actualWh <= 1_000_000;

  const savedHistory = useMemo(() => {
    if (!whenValid) return [] as (number | null)[];
    return Array.from({ length: HISTORY }, (_, i) => state.readings[addMinutes(when, -10 * (HISTORY - i))] ?? null);
  }, [state.readings, when, whenValid]);
  const savedFound = savedHistory.filter((v) => v !== null).length;

  const pasted = useMemo(() => parseList(pasteText).map((v) => (v === null ? null : v * scale)), [pasteText, scale]);

  // Totals -> the model's per-10-minute averages (1 hour = 6 intervals, 6 hours = 36).
  const summaryCheck = useMemo((): { inputs: ModelInputs | null; error: string | null } => {
    const p = parseNumber(summary.prev);
    const h1 = parseNumber(summary.h1);
    const h6 = parseNumber(summary.h6);
    if (p === null || h1 === null || h6 === null) return { inputs: null, error: null };
    if (p < 0 || h1 < 0 || h6 < 0) return { inputs: null, error: "Values can’t be negative." };
    if (h1 + 1e-9 < p)
      return { inputs: null, error: "The last-hour total includes the previous 10 minutes, so it can’t be smaller than that reading." };
    if (h6 + 1e-9 < h1) return { inputs: null, error: "The 6-hour total includes the last hour, so it can’t be smaller than the last-hour total." };
    return { inputs: { previous_interval: p * scale, rolling_1h_mean: (h1 * scale) / 6, rolling_6h_mean: (h6 * scale) / 36 }, error: null };
  }, [summary, scale]);

  const usagePerInterval = useMemo(() => {
    const v = parseNumber(usage.amount);
    return v !== null && v > 0 ? intervalFromTotal(v, usage.period) : null;
  }, [usage]);

  const inputs: ModelInputs | null = useMemo(() => {
    if (mode === "saved-history") return inputsFromHistory(savedHistory, HISTORY);
    if (mode === "pasted-history") return inputsFromHistory(pasted, HISTORY);
    if (mode === "estimated-from-usage")
      return usagePerInterval === null
        ? null
        : { previous_interval: usagePerInterval, rolling_1h_mean: usagePerInterval, rolling_6h_mean: usagePerInterval };
    return summaryCheck.inputs;
  }, [mode, savedHistory, pasted, summaryCheck, usagePerInterval]);

  const signature = JSON.stringify([when, actualWh, inputs]);
  const stale = result !== null && result.signature !== signature;

  // default to saved history when it is complete
  useEffect(() => {
    if (!demo && savedFound === HISTORY) setMode("saved-history");
    else if (!demo && mode === "saved-history" && savedFound < HISTORY && pasteText === "") setMode("pasted-history");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFound]);

  // ---- demo data
  const openDemos = async () => {
    setShowDemos(true);
    if (!demos) setDemos(await loadDemos());
  };

  const applyDemo = (d: DemoSample) => {
    setDemo(d);
    setWhen(d.timestamp);
    setUnit("Wh");
    setActualText(String(d.actualWh));
    setMode("pasted-history");
    setPasteText(d.history.join(", "));
    setResult(null);
    setSavedId(null);
    setPhase("idle");
    setShowDemos(false);
    setStep(4);
  };

  useEffect(() => {
    const q = params.get("demo");
    if (!q) return;
    loadDemos().then((list) => {
      setDemos(list);
      const match = list.find((d) => d.id === q);
      if (match) applyDemo(match);
      else setShowDemos(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // Any manual edit means this is no longer the untouched held-out example.
  const editField = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDemo(null);
  };

  // ---- run the real model
  const run = async () => {
    if (!whenValid || !actualValid || !inputs || actualWh === null) return;
    setError(null);
    setPhase("running");
    setStage(0);
    setSavedId(null);
    try {
      const model = await loadModel();
      setStage(1);
      if (!reduce) await sleep(320);
      const inf = analyse(model, actualWh, inputs);
      setStage(2);
      if (!reduce) await sleep(320);
      const res = {
        expectedWh: inf.expectedWh,
        residualWh: inf.residualWh,
        percentile: inf.percentile,
        flagged: inf.flagged,
        thresholdWh: inf.thresholdWh,
        potentialExcessWh: inf.flagged ? inf.residualWh : 0,
        outOfRange: inf.outOfRange,
        position: inf.position,
      };
      const actions = suggestActions({ timestamp: when, result: res }, state.profile.buildingType, state.analyses);
      setStage(3);
      if (!reduce) await sleep(260);
      setResult({
        signature,
        timestamp: when,
        source: demo ? "demo" : "manual",
        demoId: demo?.id,
        actualWh,
        contextMethod: mode,
        inputs: inf.inputs,
        result: res,
        explanation: inf.explanation,
        model: { name: model.modelName, format: model.format, trees: inf.treesEvaluated },
        actions,
        pythonReference: demo ? demo.pythonReference : undefined,
      });
      setPhase("done");
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The analysis could not run.");
      setPhase("idle");
    }
  };

  const save = () => {
    if (!result || stale) return;
    const id = newId();
    const { signature: _sig, ...data } = result;
    void _sig;
    const analysis: Analysis = { ...data, id, createdAt: new Date().toISOString() };
    const readings: Record<string, number> = {};
    if (mode === "pasted-history") pasted.forEach((v, i) => v !== null && (readings[addMinutes(when, -10 * (HISTORY - i))] = v));
    saveAnalysis(analysis, readings);
    setSavedId(id);
  };

  const analyzeNext = () => {
    setWhen(addMinutes(when, 10));
    setActualText("");
    setDemo(null);
    setMode("saved-history");
    setResult(null);
    setSavedId(null);
    setPhase("idle");
    setStep(2);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  const step1Done = whenValid;
  const step2Done = actualValid;
  const step3Done = inputs !== null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Analyze energy"
        title="Is this reading normal?"
        sub="Enter one 10-minute reading. WATTWISE predicts what it expected and shows how much looks unusually high."
        aside={
          <Button variant="secondary" onClick={openDemos} aria-expanded={showDemos}>
            <IconFlask size={18} className="text-blue" /> Try with demo data
          </Button>
        }
      />

      <AnimatePresence>
        {showDemos && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
            aria-label="Demo data"
          >
            <div className="surface p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink">Held-out test examples</h2>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-2">
                    Real readings from the final test period, which the model never saw in training. Each one comes with its 6 hours of real
                    history and runs through the same in-browser model as your own readings.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowDemos(false)}>
                  Close
                </Button>
              </div>
              {!demos ? (
                <p className="mt-5 text-sm text-ink-3" role="status">
                  Loading examples…
                </p>
              ) : (
                <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {demos.map((d, i) => (
                    <motion.li key={d.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * 0.04 }}>
                      <button
                        type="button"
                        onClick={() => applyDemo(d)}
                        className="tap group flex h-full w-full cursor-pointer flex-col rounded-2xl border border-line bg-canvas p-4 text-left transition-colors hover:border-blue/50 hover:bg-blue-soft/50"
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-blue">{d.label}</span>
                        <span className="mt-1.5 font-semibold text-ink">{d.description}</span>
                        <span className="mt-1 text-sm text-ink-3">{fmtWhen(d.timestamp)}</span>
                        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-ink-2 group-hover:text-blue">
                          Load example <IconArrowRight size={15} />
                        </span>
                      </button>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {demo && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-blue-soft px-4 py-3 text-sm text-blue">
          <IconFlask size={16} />
          <span>
            <strong>Held-out test example</strong> loaded: {demo.description.toLowerCase()}. Edit any value to make it your own.
          </span>
        </p>
      )}

      {/* ---- Guided steps */}
      <ol className="relative space-y-4">
        <span aria-hidden className="absolute bottom-6 left-[1.6rem] top-6 hidden w-0.5 rounded-full bg-line sm:block" />
        <motion.span
          aria-hidden
          className="absolute left-[1.6rem] top-6 hidden w-0.5 origin-top rounded-full bg-sage sm:block"
          style={{ bottom: "1.5rem" }}
          initial={false}
          animate={{ scaleY: [step1Done, step2Done, step3Done].filter(Boolean).length / 3 }}
          transition={{ duration: 0.5, ease: EASE }}
        />

        <Step n={1} title="When?" active={step === 1} done={step1Done && step !== 1} summary={whenValid ? `${fmtWhen(when)} (${fmtInterval(when)})` : ""} onOpen={() => setStep(1)}>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Start of the 10-minute interval</span>
            <input
              type="datetime-local"
              step={600}
              value={when}
              onChange={(e) => e.target.value && editField(setWhen)(floorTo10(e.target.value.slice(0, 16)))}
              className="mt-2 h-14 w-full max-w-sm rounded-2xl border border-line-strong bg-surface px-4 text-lg font-semibold text-ink"
            />
          </label>
          <p className="mt-2 text-sm text-ink-3">Readings are grouped into 10-minute intervals, rounded down to the nearest 10 minutes.</p>
          <StepNext disabled={!whenValid} onClick={() => setStep(2)} />
        </Step>

        <Step
          n={2}
          title="How much energy?"
          active={step === 2}
          done={step2Done && step !== 2}
          summary={actualValid && actualWh !== null ? `${fmtNum(actualWh, actualWh % 1 ? 1 : 0)} Wh in ${fmtInterval(when)}` : ""}
          onOpen={() => setStep(2)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-ink">Energy used in this interval</span>
            <Segmented
              size="sm"
              label="Unit"
              value={unit}
              onChange={editField(setUnit)}
              options={[
                { value: "Wh", label: "Wh" },
                { value: "kWh", label: "kWh" },
              ]}
            />
          </div>
          <div className="mt-3 flex h-20 max-w-sm items-center rounded-3xl border border-line-strong bg-surface px-5 focus-within:border-blue">
            <input
              aria-label={`Actual reading in ${unit}`}
              inputMode="decimal"
              value={actualText}
              onChange={(e) => editField(setActualText)(e.target.value)}
              className="num h-full w-full bg-transparent text-4xl font-bold text-ink outline-none"
            />
            <span className="text-lg font-semibold text-ink-3">{unit}</span>
          </div>
          <p className={`mt-2 text-sm ${actualText && !actualValid ? "text-danger" : "text-ink-3"}`}>
            {actualText && !actualValid
              ? "Enter a number of zero or more."
              : "The energy your meter recorded in these 10 minutes only, not a daily or monthly total."}
          </p>
          {actualValid && actualWh !== null && (
            <p className="mt-2 rounded-2xl bg-sunken px-4 py-3 text-sm leading-relaxed text-ink-2">
              <strong className="text-ink">{fmtBoth(actualWh)}</strong> in 10 minutes. If use stayed at this rate, that’s{" "}
              <span className="num">{fmtEnergy(actualWh * 6)}</span> per hour, <span className="num">{fmtEnergy(actualWh * 144)}</span> per day or{" "}
              <span className="num">{fmtEnergy(actualWh * 4320)}</span> per month.
            </p>
          )}
          <details className="mt-3 rounded-2xl border border-line bg-canvas px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold text-blue">Only know your monthly or daily use? Convert it</summary>
            <div className="mt-3">
              <UsageConverter value={usage} onChange={setUsage} />
            </div>
          </details>
          <StepNext disabled={!actualValid} onClick={() => setStep(3)} />
        </Step>

        <Step
          n={3}
          title="Recent context"
          active={step === 3}
          done={step3Done && step !== 3}
          summary={inputs ? `Previous 10 min ${fmtEnergy(inputs.previous_interval)} · last hour ${fmtEnergy(inputs.rolling_1h_mean * 6)} · last 6 h ${fmtEnergy(inputs.rolling_6h_mean * 36)}` : ""}
          onOpen={() => setStep(3)}
        >
          <p className="text-sm leading-relaxed text-ink-2">
            The model needs what happened in the <strong className="text-ink">6 hours before</strong> this interval. WATTWISE never fills in
            missing readings.
          </p>
          <div className="mt-4">
            <Segmented
              label="How to provide recent context"
              value={mode}
              onChange={editField(setMode)}
              options={[
                { value: "saved-history", label: `Saved (${savedFound}/36)` },
                { value: "pasted-history", label: "Paste 36 readings" },
                { value: "summary-values", label: "Enter totals" },
                { value: "estimated-from-usage", label: "From monthly/daily use" },
              ]}
            />
          </div>

          <div className="mt-5">
            {mode === "saved-history" &&
              (savedFound === HISTORY ? (
                <p className="flex items-center gap-2 rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage-strong">
                  <IconCheck size={16} /> Found all 36 readings before {fmtInterval(when)} in your saved history.
                </p>
              ) : (
                <div className="rounded-2xl bg-sunken px-4 py-4 text-sm leading-relaxed text-ink-2">
                  <p>
                    Found <strong className="text-ink">{savedFound} of 36</strong> readings from {fmtWhen(addMinutes(when, -360))} to{" "}
                    {fmtWhen(addMinutes(when, -10))}.
                  </p>
                  <p className="mt-1">
                    Saved readings build up as you analyze consecutive intervals. For now, paste the last 36 readings or enter summary values.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1" aria-label={`${savedFound} of 36 readings available`}>
                    {savedHistory.map((v, i) => (
                      <span key={i} className={`size-2.5 rounded-sm ${v === null ? "bg-line-strong" : "bg-sage-bright"}`} />
                    ))}
                  </div>
                </div>
              ))}

            {mode === "pasted-history" && (
              <label className="block">
                <span className="text-sm font-semibold text-ink">
                  The 36 readings before this interval, oldest first ({unit}, separated by commas, spaces or new lines)
                </span>
                <textarea
                  value={pasteText}
                  onChange={(e) => editField(setPasteText)(e.target.value)}
                  rows={4}
                  className="num mt-2 w-full rounded-2xl border border-line-strong bg-surface p-4 text-sm text-ink outline-none focus:border-blue"
                />
                <span
                  className={`mt-1 block text-sm ${
                    pasted.length === HISTORY && !pasted.includes(null) ? "text-sage-strong" : pasteText ? "text-danger" : "text-ink-3"
                  }`}
                >
                  {pasted.includes(null)
                    ? "Some entries aren’t numbers."
                    : `${pasted.length} of 36 readings${pasted.length > HISTORY ? " (too many: provide exactly 36)" : ""}`}
                </span>
              </label>
            )}

            {mode === "summary-values" && (
              <div>
              <p className="mb-3 text-sm text-ink-2">
                Enter the <strong className="text-ink">total energy</strong> used in each period before this interval. WATTWISE converts the totals to
                per-10-minute averages for the model.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["prev", "Previous 10 minutes", "the 10 minutes just before"],
                    ["h1", "Total for the last hour", "includes the previous 10 minutes"],
                    ["h6", "Total for the last 6 hours", "includes the last hour"],
                  ] as const
                ).map(([k, label, hint]) => (
                  <label key={k} className="block">
                    <span className="text-sm font-semibold text-ink">{label}</span>
                    <span className="block text-xs text-ink-3">{hint}</span>
                    <div className="mt-2 flex h-12 items-center rounded-2xl border border-line-strong bg-surface px-3 focus-within:border-blue">
                      <input
                        inputMode="decimal"
                        value={summary[k]}
                        onChange={(e) => editField(setSummary)({ ...summary, [k]: e.target.value })}
                        className="num w-full bg-transparent text-lg font-semibold text-ink outline-none"
                      />
                      <span className="text-sm text-ink-3">{unit}</span>
                    </div>
                  </label>
                ))}
              </div>
              {summaryCheck.error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {summaryCheck.error}
                </p>
              )}
              </div>
            )}

            {mode === "estimated-from-usage" && (
              <div>
                <p className="mb-3 text-sm leading-relaxed text-ink-2">
                  No recent readings? Use your average from a bill or app. WATTWISE spreads it evenly over time, so the result is an{" "}
                  <strong className="text-ink">estimate</strong> and less precise than real recent readings.
                </p>
                <UsageConverter value={usage} onChange={editField(setUsage)} />
              </div>
            )}
          </div>

          {inputs && (
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["Previous 10 minutes", inputs.previous_interval, 1],
                  ["Last hour", inputs.rolling_1h_mean, 6],
                  ["Last 6 hours", inputs.rolling_6h_mean, 36],
                ] as const
              ).map(([k, v, n]) => (
                <div key={k} className="rounded-2xl border border-line bg-canvas px-4 py-3">
                  <p className="text-xs font-semibold text-ink-3">{k}</p>
                  <p className="num text-lg font-bold text-ink">
                    {fmtEnergy(v * n)}
                    {n > 1 ? " total" : ""}
                  </p>
                  {n > 1 && <p className="num text-xs text-ink-2">= {fmtEnergy(v)} per 10 min (model input)</p>}
                </div>
              ))}
            </div>
          )}
          <StepNext disabled={!inputs} onClick={() => setStep(4)} />
        </Step>

        <Step n={4} title="Run the analysis" active={step === 4} done={false} summary="" onOpen={() => setStep(4)}>
          {!(step1Done && step2Done && step3Done) ? (
            <p className="text-sm text-ink-2">
              Complete{" "}
              {[!step1Done && "when", !step2Done && "the reading", !step3Done && "recent context"].filter(Boolean).join(", ")} first.
            </p>
          ) : (
            <div className="flex flex-col items-start gap-5">
              <p className="text-sm leading-relaxed text-ink-2">
                Runs the trained {site.model?.selected.name ?? "WATTWISE"} model locally in this browser, with the same trees and anomaly
                calibration as the research pipeline. No data leaves this device.
              </p>
              <Button size="lg" onClick={run} disabled={phase === "running"}>
                <IconBolt size={20} /> {phase === "running" ? "Analyzing…" : result && !stale ? "Analyze again" : "Analyze with WATTWISE"}
              </Button>
              <AnimatePresence>{phase === "running" && <RunStages stage={stage} />}</AnimatePresence>
              {error && (
                <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          )}
        </Step>
      </ol>

      {/* ---- Result */}
      <div ref={resultRef} className="scroll-mt-24">
        <AnimatePresence>
          {result && phase === "done" && (
            <motion.div key={result.signature} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING}>
              {stale && (
                <p role="status" className="mb-4 rounded-2xl bg-amber-soft px-4 py-3 text-sm font-medium text-amber">
                  Inputs changed since this result. Analyze again to update it.
                </p>
              )}
              <ResultView
                data={result}
                tariff={state.tariff}
                checks={savedId ? state.actions[savedId] : undefined}
                onToggleAction={savedId ? (aid) => toggleAction(savedId, aid) : undefined}
                footer={
                  <div className="surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    {savedId ? (
                      <>
                        <p className="flex items-center gap-2 font-semibold text-sage-strong" role="status">
                          <span className="grid size-7 place-items-center rounded-full bg-sage text-white">
                            <IconCheck size={15} />
                          </span>
                          Saved to your history in this browser.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <ButtonLink href={`/analysis/?id=${savedId}`} variant="secondary">
                            Open in history
                          </ButtonLink>
                          <Button onClick={analyzeNext}>
                            Analyze next interval <IconArrowRight size={18} />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="font-semibold text-ink">Keep this result?</p>
                          <PrivacyNote compact />
                        </div>
                        <Button size="lg" onClick={save} disabled={stale}>
                          Save to history
                        </Button>
                      </>
                    )}
                  </div>
                }
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {state.analyses.length === 0 && phase !== "done" && (
        <p className="text-center text-sm text-ink-3">
          New here? <button className="cursor-pointer font-semibold text-blue underline-offset-4 hover:underline" onClick={openDemos}>Load a held-out test example</button> to see a complete analysis.
        </p>
      )}
      {savedId && (
        <p className="text-center text-sm text-ink-3">
          <Link href="/insights/" className="font-semibold text-blue underline-offset-4 hover:underline">
            See your savings picture
          </Link>
        </p>
      )}
    </div>
  );
}

function Step({
  n,
  title,
  active,
  done,
  summary,
  onOpen,
  children,
}: {
  n: number;
  title: string;
  active: boolean;
  done: boolean;
  summary: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <li className="relative sm:pl-16">
      <span
        aria-hidden
        className={`absolute left-0 top-4 z-10 hidden size-[3.25rem] place-items-center rounded-full border-4 border-canvas text-base font-bold transition-colors sm:grid ${
          done ? "bg-sage text-white" : active ? "bg-ink text-white" : "bg-sunken text-ink-3"
        }`}
      >
        {done ? <IconCheck size={20} /> : n}
      </span>
      <div className={`surface overflow-hidden transition-shadow ${active ? "shadow-[var(--shadow-lift)]" : ""}`}>
        <button
          type="button"
          onClick={onOpen}
          aria-expanded={active}
          className="tap flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left sm:px-7 sm:py-5"
        >
          <span className="min-w-0">
            <span className="text-xs font-semibold text-ink-3 sm:hidden">Step {n} · </span>
            <span className="text-lg font-bold text-ink">{title}</span>
            {!active && summary && <span className="mt-0.5 block truncate text-sm text-ink-2">{summary}</span>}
          </span>
          {!active && <span className="shrink-0 text-sm font-semibold text-blue">{done ? "Edit" : "Open"}</span>}
        </button>
        <AnimatePresence initial={false}>
          {active && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
            >
              <div className="px-5 pb-6 sm:px-7 sm:pb-7">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

function StepNext({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <div className="mt-6">
      <Button onClick={onClick} disabled={disabled}>
        Continue <IconArrowRight size={18} />
      </Button>
    </div>
  );
}

function RunStages({ stage }: { stage: number }) {
  const stages = ["Loading the trained model", "Walking 200 decision trees", "Calibrating against validation surprises"];
  return (
    <motion.ol
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="w-full max-w-md space-y-2 overflow-hidden"
      aria-live="polite"
    >
      {stages.map((s, i) => {
        const done = stage > i;
        const current = stage === i;
        return (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span
              className={`grid size-6 place-items-center rounded-full transition-colors ${done ? "bg-sage text-white" : current ? "bg-blue-soft" : "bg-sunken"}`}
            >
              {done ? (
                <IconCheck size={13} />
              ) : current ? (
                <motion.span className="size-2 rounded-full bg-blue" animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} />
              ) : null}
            </span>
            <span className={done || current ? "font-medium text-ink" : "text-ink-3"}>{s}</span>
          </li>
        );
      })}
    </motion.ol>
  );
}
