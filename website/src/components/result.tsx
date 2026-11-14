"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ActionItem, Analysis, AppState } from "@/lib/storage";
import { costOf, fmtMoney, fmtNum, ordinal } from "@/lib/money";
import { fmtInterval, fmtWhen } from "@/lib/time";
import { fmtBoth, fmtEnergy } from "@/lib/units";
import { describeInput, explainResult, INPUT_INFO } from "@/lib/explain";
import { explain, type ModelInputs } from "@/lib/ml/gbm";
import { loadModel } from "@/lib/ml/load";
import { AnimatedNumber, EASE, SPRING, useReduceMotion } from "./motion";
import { CATEGORY_ICON, IconCheck, IconFlask, IconSpark } from "./icons";
import { SourceBadge, StatusPill } from "./ui";

export type ResultData = Omit<Analysis, "id" | "createdAt"> & { id?: string; createdAt?: string };

const METHOD_LABEL: Record<Analysis["contextMethod"], string> = {
  "saved-history": "derived from your saved readings",
  "pasted-history": "derived from the 36 readings provided",
  "summary-values": "converted from the totals you entered",
  "estimated-from-usage": "estimated from your monthly/daily use (assumes even use, so less precise)",
};

// unusual = top 5% of positive validation surprises (the flag line)
// low     = bottom 5% of ALL validation residuals (the mirror image, data-driven)
// normal  = everything in between, above or below expected
type Kind = "unusual" | "normal" | "low";

/** Position among ALL validation residuals, worded for people. */
function positionText(pos: number) {
  if (pos < 0.5) return { short: "Lowest", long: "lower than every interval in the validation data" };
  return { short: ordinal(pos), long: `lower than ${Math.round(100 - pos)}% of intervals in the validation data` };
}
export const LOW_POSITION = 5;
const kindOf = (r: ResultData["result"]): Kind =>
  r.flagged ? "unusual" : r.residualWh < 0 && r.position != null && r.position < LOW_POSITION ? "low" : "normal";

/* ------------------------------------------------------------------ headline */
function verdict(r: ResultData["result"], actual: number) {
  const pct = r.expectedWh > 0 ? Math.round((Math.abs(r.residualWh) / r.expectedWh) * 100) : null;
  const k = kindOf(r);
  if (k === "unusual")
    return {
      title: "WATTWISE found unusual consumption.",
      sub: `These 10 minutes used ${fmtEnergy(actual)}: ${fmtEnergy(r.residualWh)} more than expected${pct !== null ? ` (+${pct}%)` : ""}.`,
    };
  if (k === "normal")
    return {
      title: "This reading looks normal.",
      sub:
        r.residualWh >= 0
          ? `${fmtEnergy(r.residualWh)} above expected: normal variation (only differences of +${fmtEnergy(r.thresholdWh)} or more are flagged).`
          : `${fmtEnergy(Math.abs(r.residualWh))} below expected: normal variation.`,
    };
  return {
    title: "This reading is much lower than expected.",
    sub: `These 10 minutes used ${fmtEnergy(Math.abs(r.residualWh))} less than expected${pct !== null ? ` (−${pct}%)` : ""}, lower than 95% of intervals in the validation data. Nothing unusual to investigate.`,
  };
}

/* ------------------------------------------------------------------ compare bars */
export function CompareBars({ actual, expected, flagged }: { actual: number; expected: number; flagged: boolean }) {
  const reduce = useReduceMotion();
  const max = Math.max(actual, expected, 1) * 1.06;
  const a = actual / max;
  const e = expected / max;
  const grow = (delay: number) =>
    reduce ? { initial: false as const } : { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: { ...SPRING, delay } };
  return (
    <div className="relative space-y-6">
      <div>
        <div className="flex items-end justify-between gap-3">
          <span>
            <span className="label-caps block">Actual</span>
            <span className="text-xs text-ink-3">used in these 10 minutes</span>
          </span>
          <span className="num text-[2.6rem] font-bold leading-none text-ink sm:text-5xl">
            <AnimatedNumber value={actual} format={(v) => fmtNum(v)} />
            <span className="ml-1.5 text-lg font-semibold text-ink-3">Wh</span>
          </span>
        </div>
        <div className="relative mt-3 h-5 rounded-full bg-sunken">
          <motion.div className="absolute inset-y-0 left-0 origin-left rounded-full bg-ink" style={{ width: `${a * 100}%` }} {...grow(0.1)} />
          {actual > expected && (
            <motion.div
              className={`absolute inset-y-0 origin-left rounded-r-full ${flagged ? "bg-amber-bright" : "bg-ink-3"}`}
              style={{
                left: `${e * 100}%`,
                width: `${(a - e) * 100}%`,
                backgroundImage: "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.28) 0 6px, transparent 6px 12px)",
              }}
              {...grow(0.55)}
            />
          )}
        </div>
      </div>
      <div>
        <div className="flex items-end justify-between gap-3">
          <span>
            <span className="label-caps block">AI expected</span>
            <span className="text-xs text-ink-3">for the same 10 minutes</span>
          </span>
          <span className="num text-[2.6rem] font-bold leading-none text-blue sm:text-5xl">
            <AnimatedNumber value={expected} format={(v) => fmtNum(v)} delay={0.15} />
            <span className="ml-1.5 text-lg font-semibold text-ink-3">Wh</span>
          </span>
        </div>
        <div className="relative mt-3 h-5 rounded-full bg-sunken">
          <motion.div className="absolute inset-y-0 left-0 origin-left rounded-full bg-blue-bright" style={{ width: `${e * 100}%` }} {...grow(0.25)} />
          {expected > actual && (
            <motion.div
              className="absolute inset-y-0 origin-left rounded-r-full bg-blue/25"
              style={{ left: `${a * 100}%`, width: `${(e - a) * 100}%` }}
              {...grow(0.55)}
            />
          )}
        </div>
      </div>
      <div aria-hidden className="pointer-events-none absolute bottom-0 top-12 border-l-2 border-dashed border-blue/60" style={{ left: `${e * 100}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ score ring */
export function PercentileRing({ data, size = 148 }: { data: ResultData; size?: number }) {
  const reduce = useReduceMotion();
  const r = data.result;
  const k = kindOf(r);
  const pos = r.position ?? null;
  const below = r.residualWh <= 0 && pos !== null;
  // above expected: anomaly percentile (vs positive validation surprises, flag line = 95th)
  // below expected: position among ALL validation intervals
  const value = below ? (pos ?? 0) : r.percentile;
  const stroke = k === "unusual" ? "var(--color-amber-bright)" : k === "low" ? "var(--color-blue-bright)" : "var(--color-sage-bright)";
  const R = 42;
  const tickAngle = (95 / 100) * 2 * Math.PI - Math.PI / 2;
  const caption = below
    ? pos !== null
      ? `${positionText(pos).long[0].toUpperCase()}${positionText(pos).long.slice(1)}.`
      : "Below what WATTWISE expected."
    : `Bigger than ${Math.round(Math.min(r.percentile, 99.9))}% of the surprises seen in validation. Tick = flag line (95th).`;
  return (
    <figure className="flex flex-col items-center" aria-label={`${below ? "Position" : "Anomaly percentile"}: ${below && pos !== null ? positionText(pos).short : ordinal(value)}. ${caption}`}>
      <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-sunken)" strokeWidth="9" />
        <motion.circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={stroke}
          strokeWidth="9"
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: Math.max(value / 100, 0.001) }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.3 }}
        />
        {!below && (
          <line
            x1={50 + (R - 7) * Math.cos(tickAngle)}
            y1={50 + (R - 7) * Math.sin(tickAngle)}
            x2={50 + (R + 7) * Math.cos(tickAngle)}
            y2={50 + (R + 7) * Math.sin(tickAngle)}
            stroke="var(--color-ink)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        )}
        <text x="50" y="50" textAnchor="middle" className="num" fontSize={below && pos !== null && pos < 0.5 ? 15 : 19} fontWeight="700" fill="var(--color-ink)">
          {below && pos !== null ? positionText(pos).short : ordinal(value)}
        </text>
        <text x="50" y="63" textAnchor="middle" fontSize="7" fontWeight="600" fill="var(--color-ink-3)" letterSpacing="0.6">
          {below ? "POSITION" : "PERCENTILE"}
        </text>
      </svg>
      <figcaption className="mt-1 max-w-[13rem] text-center text-xs leading-snug text-ink-3">{caption}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ conversions */
function ConversionTable({ actual, expected }: { actual: number; expected: number }) {
  const cols = [
    { label: "10 min", n: 1 },
    { label: "per hour", n: 6 },
    { label: "per day", n: 144 },
    { label: "per month", n: 4320 },
  ];
  const rows = [
    { label: "Actual", v: actual, cls: "text-ink" },
    { label: "AI expected", v: expected, cls: "text-blue" },
    { label: "Difference", v: actual - expected, cls: actual >= expected ? "text-amber" : "text-blue" },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[30rem] text-sm">
        <caption className="sr-only">This reading converted to hourly, daily and monthly rates</caption>
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="py-2 pr-3 font-semibold" scope="col">
              Same rate over…
            </th>
            {cols.map((c) => (
              <th key={c.label} className="py-2 pl-3 text-right font-semibold" scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="num divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink-2">
                {r.label}
              </th>
              {cols.map((c) => (
                <td key={c.label} className={`py-2 pl-3 text-right font-semibold ${r.cls}`}>
                  {r.label === "Difference" && r.v > 0 ? "+" : ""}
                  {fmtEnergy(r.v * c.n)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-3">
        The model compares <strong className="font-semibold text-ink-2">10-minute</strong> amounts. The other columns show what each would add up to if it
        continued at the same rate, for context only. 1 kWh = 1,000 Wh = 1 unit on most bills.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ energy flow */
function Connector({ index, reduce }: { index: number; reduce: boolean }) {
  const draw = reduce
    ? {}
    : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { delay: 0.35 + index * 0.18, duration: 0.35 } };
  return (
    <div aria-hidden className="flex items-center justify-center lg:w-5 lg:shrink-0">
      <svg width="12" height="34" viewBox="0 0 12 34" className="lg:hidden">
        <motion.path d="M6 2 V32" stroke="var(--color-line-strong)" strokeWidth="2" strokeLinecap="round" {...draw} />
        <path d="M6 2 V32" stroke="var(--color-sage-bright)" strokeWidth="2" strokeDasharray="3 7" className="flow-dash" />
      </svg>
      <svg width="20" height="12" viewBox="0 0 20 12" className="hidden lg:block">
        <motion.path d="M2 6 H18" stroke="var(--color-line-strong)" strokeWidth="2" strokeLinecap="round" {...draw} />
        <path d="M2 6 H18" stroke="var(--color-sage-bright)" strokeWidth="2" strokeDasharray="3 7" className="flow-dash" />
      </svg>
    </div>
  );
}

export function EnergyFlow({ data, tariff }: { data: ResultData; tariff: AppState["tariff"] }) {
  const reduce = useReduceMotion();
  const r = data.result;
  const k = kindOf(r);
  const diff = Math.abs(r.residualWh);
  const cost = costOf(diff, tariff);
  const money = cost === null || !tariff ? "Set tariff" : fmtMoney(cost, tariff.currency);
  const n = data.actions.length;
  const tone = k === "unusual" ? "amber" : k === "low" ? "blue" : "sage";
  const neg = r.residualWh < 0;
  const nodes = [
    { key: "used", value: `${fmtNum(data.actualWh)} Wh`, label: "used", tone: "ink" },
    { key: "expected", value: `${fmtNum(r.expectedWh)} Wh`, label: "expected", tone: "blue" },
    {
      key: "diff",
      value: `${neg ? "−" : "+"}${fmtNum(diff)} Wh`,
      label: k === "unusual" ? "potential excess" : neg ? "less than expected" : "above expected (normal range)",
      tone,
    },
    { key: "kwh", value: `${(diff / 1000).toLocaleString("en", { maximumFractionDigits: 3 })} kWh`, label: neg ? "energy below expected" : "of energy", tone },
    {
      key: "cost",
      value: money,
      label: cost === null ? "to estimate cost" : k === "unusual" ? "possible excess cost" : neg ? "less than expected cost" : "cost of the difference",
      tone,
      href: cost === null ? "/settings/" : undefined,
    },
    { key: "checks", value: String(n), label: n ? `thing${n === 1 ? "" : "s"} worth checking` : "nothing to check", tone: "sage" },
  ];
  const toneCls: Record<string, string> = {
    ink: "bg-surface text-ink",
    blue: "bg-blue-soft text-blue",
    amber: "bg-amber-soft text-amber",
    sage: "bg-sage-soft text-sage-strong",
  };
  return (
    <ol className="flex flex-col items-stretch lg:flex-row lg:items-stretch" aria-label="From energy used to things worth checking">
      {nodes.map((node, i) => (
        <li key={node.key} className="flex flex-col lg:flex-1 lg:flex-row">
          {i > 0 && <Connector index={i} reduce={reduce} />}
          <motion.div
            className={`flex-1 rounded-2xl border border-line px-4 py-3.5 lg:min-w-0 lg:px-3 ${toneCls[node.tone]}`}
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...SPRING, delay: 0.25 + i * 0.18 }}
          >
            {node.href ? (
              <Link href={node.href} className="num block whitespace-nowrap text-lg font-bold underline-offset-4 hover:underline xl:text-xl">
                {node.value}
              </Link>
            ) : (
              <p className="num whitespace-nowrap text-lg font-bold leading-tight xl:text-xl">{node.value}</p>
            )}
            <p className="mt-0.5 text-[13px] font-medium leading-snug opacity-90">{node.label}</p>
          </motion.div>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ why panel */
function useExplanation(data: ResultData) {
  const [exp, setExp] = useState(data.explanation ?? null);
  useEffect(() => {
    if (data.explanation) return setExp(data.explanation);
    // older saved analyses: compute the explanation with the same model, on demand
    let alive = true;
    loadModel().then((m) => alive && setExp(explain(m, data.inputs)));
    return () => {
      alive = false;
    };
  }, [data.explanation, data.inputs]);
  return exp;
}

function WhyPanel({ data }: { data: ResultData }) {
  const reduce = useReduceMotion();
  const exp = useExplanation(data);
  const { facts, possible } = explainResult({ ...data, explanation: exp ?? undefined, low: kindOf(data.result) === "low" });
  const r = data.result;
  const steps = exp
    ? [
        { label: "Typical 10 minutes", sub: "before looking at your data", value: exp.base, kind: "base" as const },
        ...(Object.entries(exp.contributions) as [keyof ModelInputs, number][]).map(([key, v]) => ({
          label: INPUT_INFO[key].label,
          sub: describeInput(key, data.inputs[key]),
          value: v,
          kind: "delta" as const,
        })),
      ]
    : [];
  let running = exp ? exp.base : 0;
  const spans = steps.map((s) => {
    if (s.kind === "base") return { from: 0, to: s.value };
    const from = running;
    running += s.value;
    return { from: Math.min(from, running), to: Math.max(from, running) };
  });
  const scale = Math.max(1, r.expectedWh, ...spans.map((x) => x.to)) * 1.08;

  return (
    <section className="surface px-5 py-6 sm:px-8 sm:py-7" aria-labelledby="why-title">
      <h3 id="why-title" className="text-xl font-bold text-ink">
        Why this result?
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        WATTWISE compared <strong className="text-ink">{fmtBoth(data.actualWh)}</strong> used from {fmtInterval(data.timestamp)} with the{" "}
        <strong className="text-blue">{fmtBoth(r.expectedWh)}</strong> it expected for that same 10 minutes, based on the 6 hours before.
      </p>

      {exp && (
        <div className="mt-6">
          <h4 className="text-sm font-bold text-ink">How the model built its expectation</h4>
          <p className="mt-0.5 text-xs text-ink-3">
            Traced through all of the model’s decision trees: starting from a typical 10 minutes, each input moves the expectation up (amber) or down (blue).
          </p>
          <ol className="mt-4 space-y-3">
            {steps.map((s, i) => {
              const left = (spans[i].from / scale) * 100;
              const w = ((spans[i].to - spans[i].from) / scale) * 100;
              const up = s.value >= 0;
              return (
                <li key={s.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 sm:grid-cols-[13rem_1fr_6rem]">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{s.label}</span>
                    <span className="block truncate text-xs text-ink-3" title={s.sub}>
                      {s.sub}
                    </span>
                  </span>
                  <span className="relative h-3 rounded-full bg-sunken">
                    <motion.span
                      className={`absolute inset-y-0 origin-left rounded-full ${
                        s.kind === "base" ? "bg-ink-3/50" : up ? "bg-amber-bright" : "bg-blue-bright"
                      }`}
                      style={{ left: `${left}%`, width: `${Math.max(w, 0.8)}%` }}
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ ...SPRING, delay: 0.3 + i * 0.12 }}
                    />
                  </span>
                  <span className={`num text-right text-sm font-bold ${s.kind === "base" ? "text-ink" : up ? "text-amber" : "text-blue"}`}>
                    {s.kind === "base" ? fmtEnergy(s.value) : `${up ? "+" : "−"}${fmtEnergy(Math.abs(s.value))}`}
                  </span>
                </li>
              );
            })}
            <li className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 border-t border-line pt-3 sm:grid-cols-[13rem_1fr_6rem]">
              <span className="text-sm font-bold text-blue">= AI expected</span>
              <span className="relative h-3 rounded-full bg-sunken">
                <span className="absolute inset-y-0 left-0 rounded-full bg-blue" style={{ width: `${(r.expectedWh / scale) * 100}%` }} />
              </span>
              <span className="num text-right text-sm font-bold text-blue">{fmtEnergy(r.expectedWh)}</span>
            </li>
          </ol>
        </div>
      )}

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-bold text-ink">What WATTWISE found</h4>
          <ul className="mt-2 space-y-2">
            {facts.map((f) => (
              <li key={f} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-sunken/70 p-4">
          <h4 className="text-sm font-bold text-ink">Possible explanations to consider</h4>
          <ul className="mt-2 space-y-2">
            {possible.map((p) => (
              <li key={p} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-sage-bright" />
                {p}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">WATTWISE can’t see devices or people, so these are possibilities, not diagnoses.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ actions */
export function ActionList({
  actions,
  checks,
  onToggle,
}: {
  actions: ActionItem[];
  checks?: Record<string, string>;
  onToggle?: (id: string) => void;
}) {
  const reduce = useReduceMotion();
  return (
    <ul className="space-y-3">
      {actions.map((a, i) => {
        const Icon = CATEGORY_ICON[a.category];
        const checkedAt = checks?.[a.id];
        return (
          <motion.li
            key={a.id}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.1 + i * 0.08 }}
            className={`flex gap-4 rounded-2xl border p-4 transition-colors sm:p-5 ${checkedAt ? "border-sage/30 bg-sage-soft/60" : "border-line bg-surface"}`}
          >
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${checkedAt ? "bg-sage text-white" : "bg-sunken text-ink-2"}`}>
              <Icon size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h4 className={`font-bold ${checkedAt ? "text-ink-2 line-through decoration-sage/60" : "text-ink"}`}>{a.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-ink-2">{a.detail}</p>
              {onToggle ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!checkedAt}
                  onClick={() => onToggle(a.id)}
                  className={`tap mt-3 inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                    checkedAt ? "bg-sage text-white hover:bg-sage-strong" : "border border-line-strong bg-surface text-ink hover:border-ink-3"
                  }`}
                >
                  <AnimatePresence initial={false}>
                    {checkedAt && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                        <IconCheck size={16} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {checkedAt ? "Checked" : "Mark as checked"}
                </button>
              ) : (
                <p className="mt-3 text-xs font-medium text-ink-3">Save this analysis to track your checks.</p>
              )}
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ full result */
export function ResultView({
  data,
  tariff,
  checks,
  onToggleAction,
  footer,
}: {
  data: ResultData;
  tariff: AppState["tariff"];
  checks?: Record<string, string>;
  onToggleAction?: (id: string) => void;
  footer?: React.ReactNode;
}) {
  const r = data.result;
  const k = kindOf(r);
  const v = verdict(r, data.actualWh);
  const diff = Math.abs(r.residualWh);
  const cost = costOf(diff, tariff);
  const status = k === "unusual" ? "unusual" : k === "low" ? "below" : "normal";
  const position = r.position ?? null;
  const neg = r.residualWh < 0;

  const stats = [
    {
      k: "Difference",
      v: `${r.residualWh >= 0 ? "+" : "−"}${fmtEnergy(diff)}`,
      sub: `${neg ? "below" : "above"} expected in 10 min`,
      tone: k === "unusual" ? "text-amber" : neg ? "text-blue" : "text-ink",
    },
    {
      k: neg ? "Below expected" : "Potential excess",
      v: `${(diff / 1000).toLocaleString("en", { maximumFractionDigits: 3 })} kWh`,
      sub: k === "unusual" ? "counted as potential excess" : neg ? "no excess" : "normal variation, not counted",
      tone: k === "unusual" ? "text-amber" : neg ? "text-blue" : "text-ink",
    },
    {
      k: neg ? "Cost below expected" : "Estimated potential cost",
      v: cost === null || !tariff ? "No tariff set" : fmtMoney(cost, tariff.currency),
      sub: tariff ? `${(diff / 1000).toLocaleString("en", { maximumFractionDigits: 3 })} kWh × ${fmtMoney(tariff.perKwh, tariff.currency)}` : "",
      tone: k === "unusual" ? "text-amber" : "text-ink",
    },
    neg
      ? {
          k: "Position",
          v: position !== null ? positionText(position).short : "—",
          sub: position !== null ? positionText(position).long : "below expected",
          tone: k === "low" ? "text-blue" : "text-ink",
        }
      : { k: "Anomaly percentile", v: ordinal(r.percentile), sub: "flag line is the 95th", tone: k === "unusual" ? "text-amber" : "text-ink" },
  ];

  return (
    <div className="space-y-5">
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        className={`surface overflow-hidden ${k === "unusual" ? "ring-1 ring-amber-bright/40" : ""}`}
        aria-labelledby="verdict"
      >
        <div
          className={`px-6 pb-6 pt-7 sm:px-9 sm:pt-9 ${
            k === "unusual"
              ? "bg-gradient-to-b from-amber-soft/70 to-transparent"
              : k === "low"
                ? "bg-gradient-to-b from-blue-soft/70 to-transparent"
                : "bg-gradient-to-b from-sage-soft/60 to-transparent"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            {data.source === "demo" && <SourceBadge />}
            <span className="text-sm text-ink-3">
              {fmtWhen(data.timestamp)} <span className="hidden sm:inline">({fmtInterval(data.timestamp)})</span>
            </span>
          </div>
          <h2 id="verdict" className="mt-4 text-[1.75rem] font-bold leading-tight text-ink sm:text-[2.2rem]">
            {v.title}
          </h2>
          <p className="mt-2 max-w-2xl text-ink-2">{v.sub}</p>
        </div>

        <div className="grid gap-8 px-6 pb-6 sm:px-9 md:grid-cols-[1fr_auto] md:items-center">
          <CompareBars actual={data.actualWh} expected={r.expectedWh} flagged={r.flagged} />
          <PercentileRing data={data} />
        </div>

        <div className="border-t border-line px-6 py-5 sm:px-9">
          <ConversionTable actual={data.actualWh} expected={r.expectedWh} />
        </div>

        <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.k}
              className={`px-6 py-5 sm:px-7 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}
            >
              <dt className="text-xs font-semibold text-ink-3">{s.k}</dt>
              <dd className={`num mt-1 text-xl font-bold ${s.tone}`}>{s.v}</dd>
              {s.sub && <dd className="mt-0.5 text-xs text-ink-3">{s.sub}</dd>}
            </div>
          ))}
        </dl>
      </motion.section>

      <WhyPanel data={data} />

      <section className="surface px-5 py-6 sm:px-8 sm:py-7" aria-labelledby="flow-title">
        <h3 id="flow-title" className="flex items-center gap-2 font-bold text-ink">
          <IconSpark size={18} className="text-sage" /> From energy used to what’s worth checking
        </h3>
        <div className="mt-5">
          <EnergyFlow data={data} tariff={tariff} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-3">
          Only readings flagged as unusual (difference ≥ {fmtEnergy(r.thresholdWh)}) count toward your potential excess and savings totals. Cost = kWh ×
          your tariff{tariff ? ` (${fmtMoney(tariff.perKwh, tariff.currency)}/kWh)` : ""}. These are estimates, not measured savings.
        </p>
      </section>

      <section className="surface px-5 py-6 sm:px-8 sm:py-7" aria-labelledby="checks-title">
        <h3 id="checks-title" className="text-xl font-bold text-ink">
          What should I check?
        </h3>
        {data.actions.length ? (
          <>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              These are investigation suggestions. WATTWISE doesn’t know which device caused the unusual reading.
            </p>
            <div className="mt-5">
              <ActionList actions={data.actions} checks={checks} onToggle={onToggleAction} />
            </div>
          </>
        ) : (
          <p className="mt-2 leading-relaxed text-ink-2">
            {neg
              ? "Nothing to investigate: this interval used less than expected."
              : "Nothing unusual to investigate for this interval."}{" "}
            WATTWISE suggests checks only when a reading is flagged as unusual.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-sunken/60 px-5 py-6 sm:px-8" aria-labelledby="how-title">
        <h3 id="how-title" className="flex items-center gap-2 font-bold text-ink">
          <IconFlask size={18} className="text-blue" /> Model inputs used
        </h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {(Object.keys(INPUT_INFO) as (keyof ModelInputs)[]).map((key) => (
            <div key={key} className="rounded-2xl bg-surface px-4 py-3">
              <dt className="text-xs font-semibold text-ink-3">{INPUT_INFO[key].label}</dt>
              <dd className="num mt-0.5 text-sm font-bold text-ink">{describeInput(key, data.inputs[key])}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          Recent context was {METHOD_LABEL[data.contextMethod]}. The {data.model.name} model ({data.model.trees} trees) ran in this browser and predicted{" "}
          <span className="num font-semibold text-ink">{fmtNum(r.expectedWh, 2)} Wh</span> for this 10-minute interval.
        </p>
        {r.outOfRange.length > 0 && (
          <p className="mt-3 rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber">
            Some inputs ({r.outOfRange.map((f) => INPUT_INFO[f as keyof ModelInputs]?.period ?? f).join(", ")}) are outside the range seen in training, so
            this prediction is less reliable. Hour and 6-hour values should be totals for those periods.
          </p>
        )}
        {data.pythonReference && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage-strong">
            <IconCheck size={16} />
            <span>
              Verified against the Python model: <span className="num font-semibold">{fmtNum(data.pythonReference.expectedWh, 4)} Wh</span> (difference{" "}
              {Math.abs(data.pythonReference.expectedWh - r.expectedWh).toExponential(1)} Wh).
            </span>
          </p>
        )}
      </section>

      {footer}
    </div>
  );
}

export function MiniCompare({ actual, expected, flagged }: { actual: number; expected: number; flagged: boolean }) {
  const max = Math.max(actual, expected, 1);
  return (
    <div className="w-full space-y-1.5" aria-hidden>
      <div className="h-1.5 rounded-full bg-sunken">
        <div className={`h-full rounded-full ${flagged ? "bg-amber-bright" : "bg-ink"}`} style={{ width: `${(actual / max) * 100}%` }} />
      </div>
      <div className="h-1.5 rounded-full bg-sunken">
        <div className="h-full rounded-full bg-blue-bright" style={{ width: `${(expected / max) * 100}%` }} />
      </div>
    </div>
  );
}
