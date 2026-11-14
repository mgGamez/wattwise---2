"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ResultView, type ResultData } from "@/components/result";
import { IconArrowRight, IconBolt, IconCheck, IconFlask } from "@/components/icons";
import { EASE, SPRING, useReduceMotion } from "@/components/motion";
import { Button, ButtonLink, PageHeader, PrivacyNote } from "@/components/ui";
import { suggestActions } from "@/lib/actions";
import { monthName, monthShort } from "@/lib/explain";
import { analyseBill, daysInMonth, MIN_HISTORY, monthIndex, type Bill } from "@/lib/ml/bills";
import demoBills from "@/data/demo-bills.json";
import { saveAnalysis, toggleAction, useAppState, type Analysis } from "@/lib/storage";

const MAX_HISTORY = 24; // two years, so last year's same month (seasons) can be included

const fromIndex = (i: number) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
const previousMonth = () => {
  const d = new Date();
  return fromIndex(d.getFullYear() * 12 + d.getMonth() - 1);
};
const parseKwh = (t: string) => {
  const v = Number(t.trim().replace(",", "."));
  return t.trim() !== "" && Number.isFinite(v) && v >= 0 ? v : null;
};
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `a-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Row = { kwh: string; days: number };

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

  const [month, setMonth] = useState(previousMonth);
  const [kwhText, setKwhText] = useState("");
  const [billDays, setBillDays] = useState<number | null>(null); // null = calendar days of the month
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [showCount, setShowCount] = useState(6);
  const [demo, setDemo] = useState(false);
  const [step, setStep] = useState(1);
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<(ResultData & { signature: string }) | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const monthValid = /^\d{4}-\d{2}$/.test(month);
  const days = billDays ?? (monthValid ? daysInMonth(month) : 30);
  const kwh = parseKwh(kwhText);

  // the 24 months before the bill, newest first
  const priorMonths = useMemo(
    () => (monthValid ? Array.from({ length: MAX_HISTORY }, (_, i) => fromIndex(monthIndex(month) - 1 - i)) : []),
    [month, monthValid],
  );

  // pre-fill earlier months from saved bills whenever the bill month changes (manual edits win)
  useEffect(() => {
    if (demo) return;
    setRows((prev) => {
      const next: Record<string, Row> = {};
      for (const m of priorMonths) {
        const saved = state.bills[m];
        next[m] = prev[m] ?? (saved ? { kwh: String(saved.kwh), days: saved.days } : { kwh: "", days: daysInMonth(m) });
      }
      return next;
    });
  }, [priorMonths, state.bills, demo]);

  const history: Bill[] = useMemo(
    () =>
      priorMonths
        .map((m) => ({ month: m, kwh: parseKwh(rows[m]?.kwh ?? ""), days: rows[m]?.days ?? daysInMonth(m) }))
        .filter((b): b is Bill => b.kwh !== null),
    [priorMonths, rows],
  );
  const badRows = priorMonths.filter((m) => (rows[m]?.kwh ?? "").trim() !== "" && parseKwh(rows[m].kwh) === null);

  const signature = JSON.stringify([month, kwh, days, history]);
  const stale = result !== null && result.signature !== signature;

  const step1Done = monthValid;
  const step2Done = kwh !== null && days > 0;
  const step3Done = history.length >= MIN_HISTORY && badRows.length === 0;

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDemo(false);
  };

  // ---- real example bills (monthly totals from the research dataset)
  const loadDemo = () => {
    const bills = demoBills as Bill[];
    const current = bills[bills.length - 1];
    setDemo(true);
    setMonth(current.month);
    setKwhText(String(current.kwh));
    setBillDays(current.days);
    setRows(Object.fromEntries(bills.slice(0, -1).map((b) => [b.month, { kwh: String(b.kwh), days: b.days }])));
    setResult(null);
    setSavedId(null);
    setPhase("idle");
    setStep(4);
  };
  useEffect(() => {
    if (params.get("demo")) loadDemo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const run = async () => {
    if (!step1Done || !step2Done || !step3Done || kwh === null) return;
    setError(null);
    setPhase("running");
    setStage(0);
    setSavedId(null);
    try {
      if (!reduce) await sleep(300);
      setStage(1);
      const current: Bill = { month, kwh, days };
      const r = analyseBill(history, current);
      if (!reduce) await sleep(300);
      setStage(2);
      const res = {
        expectedKwh: r.expectedKwh,
        expectedPerDay: r.expectedPerDay,
        actualPerDay: r.actualPerDay,
        residualKwh: r.residualKwh,
        z: r.z,
        percentile: r.percentile,
        flagged: r.flagged,
        low: r.low,
        potentialExcessKwh: r.potentialExcessKwh,
        fit: r.fit,
      };
      const actions = suggestActions({ month, result: res }, state.profile.buildingType, state.analyses);
      if (!reduce) await sleep(260);
      setStage(3);
      setResult({ signature, month, source: demo ? "demo" : "manual", current, history, result: res, actions });
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
    const { signature: _s, ...data } = result;
    void _s;
    const a: Analysis = { ...data, id, createdAt: new Date().toISOString() };
    saveAnalysis(a);
    setSavedId(id);
  };

  const analyzeNext = () => {
    setShowCount(6);
    setMonth(fromIndex(monthIndex(month) + 1));
    setKwhText("");
    setBillDays(null);
    setDemo(false);
    setRows({});
    setResult(null);
    setSavedId(null);
    setPhase("idle");
    setStep(2);
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  const yearAgo = monthValid ? fromIndex(monthIndex(month) - 12) : "";
  const hasYearAgo = history.some((b) => b.month === yearAgo);
  // always show enough rows to reach any month that already has a value
  const filledDepth = priorMonths.reduce((d, m, i) => ((rows[m]?.kwh ?? "").trim() ? i + 1 : d), 0);
  const visibleMonths = priorMonths.slice(0, Math.max(showCount, filledDepth));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Analyze a bill"
        title="Is this month’s bill normal?"
        sub="Enter the electricity (kWh) from your bill. WATTWISE learns your normal from your past bills and shows how much looks unusually high, and what it costs."
        aside={
          <Button variant="secondary" onClick={loadDemo}>
            <IconFlask size={18} className="text-blue" /> Try with example bills
          </Button>
        }
      />

      {demo && (
        <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-blue-soft px-4 py-3 text-sm text-blue">
          <IconFlask size={16} />
          <span>
            <strong>Example bills loaded:</strong> real monthly totals for one home from the research dataset (Jan–May 2016; January and May are partial
            months). Edit any value to make it your own.
          </span>
        </p>
      )}

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

        <Step n={1} title="Which bill?" active={step === 1} done={step1Done && step !== 1} summary={monthValid ? monthName(month) : ""} onOpen={() => setStep(1)}>
          <label className="block">
            <span className="text-sm font-semibold text-ink">Billing month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => e.target.value && edit(setMonth)(e.target.value)}
              className="mt-2 h-14 w-full max-w-xs rounded-2xl border border-line-strong bg-surface px-4 text-lg font-semibold text-ink"
            />
          </label>
          <StepNext disabled={!step1Done} onClick={() => setStep(2)} />
        </Step>

        <Step
          n={2}
          title="How much electricity?"
          active={step === 2}
          done={step2Done && step !== 2}
          summary={kwh !== null ? `${kwh.toLocaleString("en")} kWh over ${days % 1 ? days.toFixed(1) : days} days` : ""}
          onOpen={() => setStep(2)}
        >
          <span className="text-sm font-semibold text-ink">Electricity used, from your bill</span>
          <div className="mt-2 flex h-20 max-w-sm items-center rounded-3xl border border-line-strong bg-surface px-5 focus-within:border-blue">
            <input
              aria-label="Electricity used in kWh"
              inputMode="decimal"
              value={kwhText}
              onChange={(e) => edit(setKwhText)(e.target.value)}
              className="num h-full w-full bg-transparent text-4xl font-bold text-ink outline-none"
            />
            <span className="text-lg font-semibold text-ink-3">kWh</span>
          </div>
          <p className={`mt-2 text-sm ${kwhText && kwh === null ? "text-danger" : "text-ink-3"}`}>
            {kwhText && kwh === null ? "Enter a number of zero or more." : "Look for “units consumed” or “kWh” on your bill. 1 unit = 1 kWh."}
          </p>
          {kwh !== null && days > 0 && (
            <p className="mt-2 rounded-2xl bg-sunken px-4 py-3 text-sm text-ink-2">
              That’s about <strong className="num text-ink">{(kwh / days).toLocaleString("en", { maximumFractionDigits: 2 })} kWh per day</strong>, or{" "}
              <span className="num">{(kwh / days / 24).toLocaleString("en", { maximumFractionDigits: 3 })} kWh per hour</span> on average.
            </p>
          )}
          <label className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            Billing period
            <input
              aria-label="Days in billing period"
              inputMode="numeric"
              value={days % 1 ? days.toFixed(2) : String(days)}
              onChange={(e) => {
                const v = Number(e.target.value);
                edit(setBillDays)(Number.isFinite(v) && v > 0 && v <= 62 ? v : null);
              }}
              className="num h-10 w-20 rounded-xl border border-line-strong bg-surface px-3 text-center font-semibold text-ink"
            />
            days <span className="text-ink-3">(change it if your bill covers a different number of days)</span>
          </label>
          <StepNext disabled={!step2Done} onClick={() => setStep(3)} />
        </Step>

        <Step
          n={3}
          title="Your past bills"
          active={step === 3}
          done={step3Done && step !== 3}
          summary={history.length ? `${history.length} past month${history.length === 1 ? "" : "s"} entered` : ""}
          onOpen={() => setStep(3)}
        >
          <p className="text-sm leading-relaxed text-ink-2">
            WATTWISE learns what’s normal for <strong className="text-ink">you</strong> from earlier bills. Enter at least {MIN_HISTORY} months. More is better: from 6
            months it learns your trend, and with last year’s same month it accounts for seasons. Saved bills fill in automatically.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMonths.map((m) => {
              const row = rows[m] ?? { kwh: "", days: daysInMonth(m) };
              const bad = row.kwh.trim() !== "" && parseKwh(row.kwh) === null;
              return (
                <label key={m} className={`flex h-12 items-center gap-2 rounded-2xl border bg-surface px-3 focus-within:border-blue ${bad ? "border-danger" : "border-line-strong"}`}>
                  <span className="w-16 shrink-0 text-sm font-semibold text-ink-2">{monthShort(m)}</span>
                  <input
                    aria-label={`${monthName(m)} kWh`}
                    inputMode="decimal"
                    value={row.kwh}
                    onChange={(e) => edit(setRows)({ ...rows, [m]: { ...row, kwh: e.target.value } })}
                    className="num w-full bg-transparent text-right text-lg font-semibold text-ink outline-none"
                  />
                  <span className="text-sm text-ink-3">kWh</span>
                </label>
              );
            })}
          </div>
          {visibleMonths.length < priorMonths.length && (
            <button
              type="button"
              onClick={() => setShowCount(visibleMonths.length < 12 ? 12 : MAX_HISTORY)}
              className="mt-3 cursor-pointer text-sm font-semibold text-blue underline-offset-4 hover:underline"
            >
              {visibleMonths.length < 12 ? "Show up to 12 months" : `Show up to 24 months (includes ${monthName(yearAgo)})`}
            </button>
          )}
          {monthValid && (
            <p className={`mt-3 rounded-2xl px-4 py-3 text-sm ${hasYearAgo ? "bg-sage-soft text-sage-strong" : "bg-sunken text-ink-2"}`}>
              {hasYearAgo
                ? `${monthName(yearAgo)} is included, so WATTWISE will account for seasons (heating and cooling).`
                : `Tip: add your bill from ${monthName(yearAgo)} so WATTWISE can account for seasons. Without it, a hot or cold month can look unusual.`}
            </p>
          )}
          <p className={`mt-3 text-sm ${badRows.length ? "text-danger" : history.length >= MIN_HISTORY ? "text-sage-strong" : "text-ink-3"}`}>
            {badRows.length
              ? "Some months aren’t numbers."
              : history.length >= MIN_HISTORY
                ? `${history.length} months entered, enough to learn your normal.`
                : `${history.length} of ${MIN_HISTORY} months needed.`}
          </p>
          <StepNext disabled={!step3Done} onClick={() => setStep(4)} />
        </Step>

        <Step n={4} title="Run the analysis" active={step === 4} done={false} summary="" onOpen={() => setStep(4)}>
          {!(step1Done && step2Done && step3Done) ? (
            <p className="text-sm text-ink-2">
              Complete {[!step1Done && "the month", !step2Done && "this bill’s kWh", !step3Done && `at least ${MIN_HISTORY} past bills`].filter(Boolean).join(", ")} first.
            </p>
          ) : (
            <div className="flex flex-col items-start gap-5">
              <p className="text-sm leading-relaxed text-ink-2">
                WATTWISE fits a model to your {history.length} past bills in this browser, predicts {monthName(month)}, and checks it against your usual variation.
                No data leaves this device.
              </p>
              <Button size="lg" onClick={run} disabled={phase === "running"}>
                <IconBolt size={20} /> {phase === "running" ? "Analyzing…" : result && !stale ? "Analyze again" : "Analyze with WATTWISE"}
              </Button>
              <AnimatePresence>{phase === "running" && <RunStages stage={stage} n={history.length} month={monthName(month)} />}</AnimatePresence>
              {error && (
                <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          )}
        </Step>
      </ol>

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
                            Analyze next month <IconArrowRight size={18} />
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

function Step({ n, title, active, done, summary, onOpen, children }: { n: number; title: string; active: boolean; done: boolean; summary: string; onOpen: () => void; children: ReactNode }) {
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
        <button type="button" onClick={onOpen} aria-expanded={active} className="tap flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left sm:px-7 sm:py-5">
          <span className="min-w-0">
            <span className="text-xs font-semibold text-ink-3 sm:hidden">Step {n} · </span>
            <span className="text-lg font-bold text-ink">{title}</span>
            {!active && summary && <span className="mt-0.5 block truncate text-sm text-ink-2">{summary}</span>}
          </span>
          {!active && <span className="shrink-0 text-sm font-semibold text-blue">{done ? "Edit" : "Open"}</span>}
        </button>
        <AnimatePresence initial={false}>
          {active && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
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

function RunStages({ stage, n, month }: { stage: number; n: number; month: string }) {
  const stages = [`Learning your normal from ${n} bills`, `Predicting ${month}`, "Checking against your usual variation"];
  return (
    <motion.ol initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="w-full max-w-md space-y-2 overflow-hidden" aria-live="polite">
      {stages.map((s, i) => {
        const done = stage > i;
        const current = stage === i;
        return (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span className={`grid size-6 place-items-center rounded-full transition-colors ${done ? "bg-sage text-white" : current ? "bg-blue-soft" : "bg-sunken"}`}>
              {done ? <IconCheck size={13} /> : current ? <motion.span className="size-2 rounded-full bg-blue" animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} /> : null}
            </span>
            <span className={done || current ? "font-medium text-ink" : "text-ink-3"}>{s}</span>
          </li>
        );
      })}
    </motion.ol>
  );
}
