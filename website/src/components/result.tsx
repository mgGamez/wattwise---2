"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { ActionItem, Analysis, AppState } from "@/lib/storage";
import { costOf, fmtKwh, fmtMoney, fmtNum, fmtSignedWh, ordinal } from "@/lib/money";
import { fmtInterval, fmtWhen } from "@/lib/time";
import { AnimatedNumber, EASE, SPRING, useReduceMotion } from "./motion";
import { CATEGORY_ICON, IconCheck, IconFlask, IconSpark } from "./icons";
import { SourceBadge, StatusPill } from "./ui";

export type ResultData = Omit<Analysis, "id" | "createdAt"> & { id?: string; createdAt?: string };

const FEATURE_LABEL: Record<string, string> = {
  previous_interval: "Previous 10-minute reading",
  rolling_1h_mean: "Average of the last hour",
  rolling_6h_mean: "Average of the last 6 hours",
};
const METHOD_LABEL = {
  "saved-history": "derived from your saved readings",
  "pasted-history": "derived from the 36 readings provided",
  "summary-values": "entered directly as summary values",
};

/* ------------------------------------------------------------------ headline */
function verdict(r: ResultData["result"]) {
  if (r.flagged)
    return {
      title: "WATTWISE found unusual consumption.",
      sub:
        r.expectedWh > 0
          ? `This interval used ${fmtNum(Math.round((r.residualWh / r.expectedWh) * 100))}% more than WATTWISE expected.`
          : `This interval used ${fmtNum(r.residualWh)} Wh more than WATTWISE expected.`,
      tone: "amber" as const,
    };
  if (r.residualWh >= 0)
    return {
      title: "This reading looks normal.",
      sub: `Slightly above what was expected, but well within the usual range (the flag line is +${fmtNum(r.thresholdWh)} Wh).`,
      tone: "sage" as const,
    };
  return { title: "This reading looks normal.", sub: "It used less than WATTWISE expected for this interval.", tone: "sage" as const };
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
        <div className="flex items-baseline justify-between gap-3">
          <span className="label-caps">Actual</span>
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
        <div className="flex items-baseline justify-between gap-3">
          <span className="label-caps">AI expected</span>
          <span className="num text-[2.6rem] font-bold leading-none text-blue sm:text-5xl">
            <AnimatedNumber value={expected} format={(v) => fmtNum(v)} delay={0.15} />
            <span className="ml-1.5 text-lg font-semibold text-ink-3">Wh</span>
          </span>
        </div>
        <div className="relative mt-3 h-5 rounded-full bg-sunken">
          <motion.div className="absolute inset-y-0 left-0 origin-left rounded-full bg-blue-bright" style={{ width: `${e * 100}%` }} {...grow(0.25)} />
        </div>
      </div>
      {/* expected marker spanning both bars */}
      <div aria-hidden className="pointer-events-none absolute bottom-0 top-9 border-l-2 border-dashed border-blue/60" style={{ left: `${e * 100}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ percentile ring */
export function PercentileRing({ percentile, flagged, size = 148 }: { percentile: number; flagged: boolean; size?: number }) {
  const reduce = useReduceMotion();
  const r = 42;
  const tick = 95; // the detection threshold is the 95th percentile of validation surprises
  const angle = (tick / 100) * 2 * Math.PI - Math.PI / 2;
  return (
    <figure className="flex flex-col items-center" aria-label={`Anomaly percentile ${ordinal(percentile)}`}>
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-sunken)" strokeWidth="9" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={flagged ? "var(--color-amber-bright)" : "var(--color-sage-bright)"}
          strokeWidth="9"
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: Math.max(percentile / 100, 0.001) }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.3 }}
        />
        <line
          x1={50 + (r - 7) * Math.cos(angle)}
          y1={50 + (r - 7) * Math.sin(angle)}
          x2={50 + (r + 7) * Math.cos(angle)}
          y2={50 + (r + 7) * Math.sin(angle)}
          stroke="var(--color-ink)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <text x="50" y="50" textAnchor="middle" className="num" fontSize="19" fontWeight="700" fill="var(--color-ink)">
          {ordinal(percentile)}
        </text>
        <text x="50" y="63" textAnchor="middle" fontSize="7.5" fontWeight="600" fill="var(--color-ink-3)" letterSpacing="0.6">
          PERCENTILE
        </text>
      </svg>
      <figcaption className="mt-1 max-w-[12rem] text-center text-xs leading-snug text-ink-3">
        Tick = flag line (95th). Compared with surprises seen during validation.
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ energy flow */
function Connector({ index, reduce }: { index: number; reduce: boolean }) {
  const draw = reduce
    ? {}
    : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { delay: 0.35 + index * 0.18, duration: 0.35 } };
  return (
    <div aria-hidden className="flex items-center justify-center lg:w-5 lg:shrink-0">
      {/* vertical on small screens */}
      <svg width="12" height="34" viewBox="0 0 12 34" className="lg:hidden">
        <motion.path d="M6 2 V32" stroke="var(--color-line-strong)" strokeWidth="2" strokeLinecap="round" {...draw} />
        <path d="M6 2 V32" stroke="var(--color-sage-bright)" strokeWidth="2" strokeDasharray="3 7" className="flow-dash" />
      </svg>
      {/* horizontal on large screens */}
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
  const excess = r.potentialExcessWh;
  const cost = costOf(excess, tariff);
  const n = data.actions.length;
  const nodes = [
    { key: "used", value: `${fmtNum(data.actualWh)} Wh`, label: "used", tone: "ink" },
    { key: "expected", value: `${fmtNum(r.expectedWh)} Wh`, label: "expected", tone: "blue" },
    {
      key: "excess",
      value: `${fmtNum(excess)} Wh`,
      label: r.flagged ? "potential excess" : "potential excess (within normal range)",
      tone: r.flagged ? "amber" : "sage",
    },
    { key: "kwh", value: fmtKwh(excess), label: "of energy", tone: r.flagged ? "amber" : "sage" },
    {
      key: "cost",
      value: cost === null || !tariff ? "Set tariff" : fmtMoney(cost, tariff.currency),
      label: cost === null ? "to estimate cost" : "possible excess cost",
      tone: r.flagged ? "amber" : "sage",
      href: cost === null ? "/settings" : undefined,
    },
    {
      key: "checks",
      value: n ? String(n) : "0",
      label: n ? `thing${n === 1 ? "" : "s"} worth checking` : "nothing to check",
      tone: "sage",
    },
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
            className={`flex gap-4 rounded-2xl border p-4 transition-colors sm:p-5 ${
              checkedAt ? "border-sage/30 bg-sage-soft/60" : "border-line bg-surface"
            }`}
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
  const v = verdict(r);
  const cost = costOf(r.potentialExcessWh, tariff);
  const status = r.flagged ? "unusual" : r.residualWh < 0 ? "below" : "normal";

  return (
    <div className="space-y-5">
      {/* Headline + comparison */}
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={SPRING}
        className={`surface overflow-hidden ${r.flagged ? "ring-1 ring-amber-bright/40" : ""}`}
        aria-labelledby="verdict"
      >
        <div className={`px-6 pb-6 pt-7 sm:px-9 sm:pt-9 ${r.flagged ? "bg-gradient-to-b from-amber-soft/70 to-transparent" : "bg-gradient-to-b from-sage-soft/60 to-transparent"}`}>
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

        <div className="grid gap-8 px-6 pb-8 sm:px-9 md:grid-cols-[1fr_auto] md:items-center">
          <CompareBars actual={data.actualWh} expected={r.expectedWh} flagged={r.flagged} />
          <PercentileRing percentile={r.percentile} flagged={r.flagged} />
        </div>

        <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
          {[
            { k: "Difference", v: fmtSignedWh(r.residualWh), tone: r.flagged ? "text-amber" : "text-ink" },
            { k: "Potential excess", v: fmtKwh(r.potentialExcessWh), tone: r.flagged ? "text-amber" : "text-ink" },
            {
              k: "Estimated potential cost",
              v: cost === null || !tariff ? "No tariff set" : fmtMoney(cost, tariff.currency),
              tone: r.flagged ? "text-amber" : "text-ink",
            },
            { k: "Anomaly percentile", v: ordinal(r.percentile), tone: "text-ink" },
          ].map((s, i) => (
            <div key={s.k} className={`px-6 py-5 sm:px-7 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
              <dt className="text-xs font-semibold text-ink-3">{s.k}</dt>
              <dd className={`num mt-1 text-xl font-bold ${s.tone}`}>{s.v}</dd>
            </div>
          ))}
        </dl>
      </motion.section>

      {/* Energy flow infographic */}
      <section className="surface px-5 py-6 sm:px-8 sm:py-7" aria-labelledby="flow-title">
        <h3 id="flow-title" className="flex items-center gap-2 font-bold text-ink">
          <IconSpark size={18} className="text-sage" /> From energy used to what’s worth checking
        </h3>
        <div className="mt-5">
          <EnergyFlow data={data} tariff={tariff} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-3">
          Potential excess counts only readings WATTWISE flags as unusual (difference ≥ {fmtNum(r.thresholdWh)} Wh). Cost = excess kWh ×
          your tariff{tariff ? ` (${fmtMoney(tariff.perKwh, tariff.currency)}/kWh)` : ""}. It’s an estimate, not a measured saving.
        </p>
      </section>

      {/* Actions */}
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
            Nothing unusual to investigate for this interval. Keep analyzing readings: WATTWISE suggests checks only when a reading is
            flagged.
          </p>
        )}
      </section>

      {/* Transparency */}
      <section className="rounded-3xl border border-line bg-sunken/60 px-5 py-6 sm:px-8" aria-labelledby="how-title">
        <h3 id="how-title" className="flex items-center gap-2 font-bold text-ink">
          <IconFlask size={18} className="text-blue" /> How WATTWISE got this
        </h3>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {Object.entries(data.inputs).map(([k, val]) => (
            <div key={k} className="rounded-2xl bg-surface px-4 py-3">
              <dt className="text-xs font-semibold text-ink-3">{FEATURE_LABEL[k] ?? k}</dt>
              <dd className="num mt-0.5 text-lg font-bold text-ink">{fmtNum(val, val % 1 ? 2 : 0)} Wh</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          Model inputs were {METHOD_LABEL[data.contextMethod]}. The {data.model.name} model ({data.model.trees} trees) ran in this browser and
          predicted <span className="num font-semibold text-ink">{fmtNum(r.expectedWh, 2)} Wh</span> for this 10-minute interval.
        </p>
        {r.outOfRange.length > 0 && (
          <p className="mt-3 rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber">
            Some inputs ({r.outOfRange.map((f) => FEATURE_LABEL[f] ?? f).join(", ")}) are outside the range seen in training, so this
            prediction is less reliable.
          </p>
        )}
        {data.pythonReference && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-sage-soft px-4 py-3 text-sm text-sage-strong">
            <IconCheck size={16} />
            <span>
              Verified against the Python model: <span className="num font-semibold">{fmtNum(data.pythonReference.expectedWh, 4)} Wh</span>{" "}
              (difference {Math.abs(data.pythonReference.expectedWh - r.expectedWh).toExponential(1)} Wh).
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

