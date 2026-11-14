"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { ActionItem, Analysis, AppState } from "@/lib/storage";
import { costOf, fmtMoney, fmtNum, ordinal } from "@/lib/money";
import { explainBill, monthName, monthShort } from "@/lib/explain";
import { AnimatedNumber, EASE, SPRING, useReduceMotion } from "./motion";
import { CATEGORY_ICON, IconCheck, IconFlask, IconSpark } from "./icons";
import { SourceBadge, StatusPill } from "./ui";

export type ResultData = Omit<Analysis, "id" | "createdAt"> & { id?: string; createdAt?: string };

type Kind = "unusual" | "normal" | "low";
const kindOf = (r: ResultData["result"]): Kind => (r.flagged ? "unusual" : r.low ? "low" : "normal");
const k1 = (v: number) => v.toLocaleString("en", { maximumFractionDigits: 1 });
const k2 = (v: number) => v.toLocaleString("en", { maximumFractionDigits: 2 });
const days = (d: number) => (d % 1 ? d.toFixed(1) : String(d));

function verdict(d: ResultData) {
  const r = d.result;
  const pct = r.expectedKwh > 0 ? Math.round((Math.abs(r.residualKwh) / r.expectedKwh) * 100) : null;
  const k = kindOf(r);
  if (k === "unusual")
    return {
      title: "WATTWISE found an unusually high bill.",
      sub: `${monthName(d.month)} used ${k1(d.current.kwh)} kWh: ${k1(r.residualKwh)} kWh more than your history suggests${pct !== null ? ` (+${pct}%)` : ""}.`,
    };
  if (k === "low")
    return {
      title: "This bill is much lower than usual.",
      sub: `${monthName(d.month)} used ${k1(Math.abs(r.residualKwh))} kWh less than your history suggests${pct !== null ? ` (−${pct}%)` : ""}. Nothing to investigate.`,
    };
  return {
    title: "This bill looks normal.",
    sub: `${monthName(d.month)} is ${k1(Math.abs(r.residualKwh))} kWh ${r.residualKwh >= 0 ? "above" : "below"} what your history suggests, within your usual month-to-month variation.`,
  };
}

/* ------------------------------------------------------------------ compare bars */
export function CompareBars({ actual, expected, flagged, actualLabel, expectedLabel }: { actual: number; expected: number; flagged: boolean; actualLabel: string; expectedLabel: string }) {
  const reduce = useReduceMotion();
  const max = Math.max(actual, expected, 0.001) * 1.06;
  const a = actual / max;
  const e = expected / max;
  const grow = (delay: number) => (reduce ? { initial: false as const } : { initial: { scaleX: 0 }, animate: { scaleX: 1 }, transition: { ...SPRING, delay } });
  return (
    <div className="relative space-y-6">
      {[
        { label: "This bill", sub: actualLabel, v: actual, cls: "text-ink", bar: "bg-ink", w: a, delay: 0.1 },
        { label: "AI expected", sub: expectedLabel, v: expected, cls: "text-blue", bar: "bg-blue-bright", w: e, delay: 0.25 },
      ].map((row, i) => (
        <div key={row.label}>
          <div className="flex items-end justify-between gap-3">
            <span>
              <span className="label-caps block">{row.label}</span>
              <span className="text-xs text-ink-3">{row.sub}</span>
            </span>
            <span className={`num text-[2.6rem] font-bold leading-none sm:text-5xl ${row.cls}`}>
              <AnimatedNumber value={row.v} format={(v) => fmtNum(v)} delay={i * 0.15} />
              <span className="ml-1.5 text-lg font-semibold text-ink-3">kWh</span>
            </span>
          </div>
          <div className="relative mt-3 h-5 rounded-full bg-sunken">
            <motion.div className={`absolute inset-y-0 left-0 origin-left rounded-full ${row.bar}`} style={{ width: `${row.w * 100}%` }} {...grow(row.delay)} />
            {i === 0 && actual > expected && (
              <motion.div
                className={`absolute inset-y-0 origin-left rounded-r-full ${flagged ? "bg-amber-bright" : "bg-ink-3"}`}
                style={{ left: `${e * 100}%`, width: `${(a - e) * 100}%`, backgroundImage: "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.28) 0 6px, transparent 6px 12px)" }}
                {...grow(0.55)}
              />
            )}
          </div>
        </div>
      ))}
      <div aria-hidden className="pointer-events-none absolute bottom-0 top-12 border-l-2 border-dashed border-blue/60" style={{ left: `${e * 100}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ score ring */
export function PercentileRing({ data, size = 148 }: { data: ResultData; size?: number }) {
  const reduce = useReduceMotion();
  const r = data.result;
  const k = kindOf(r);
  const value = Math.min(r.percentile, 99); // a normal-curve tail never truly reaches 100%
  const stroke = k === "unusual" ? "var(--color-amber-bright)" : k === "low" ? "var(--color-blue-bright)" : "var(--color-sage-bright)";
  const R = 42;
  const tick = 97.7; // z = 2, the flag line
  const ang = (tick / 100) * 2 * Math.PI - Math.PI / 2;
  const caption =
    r.residualKwh >= 0
      ? `Higher than ${value >= 99 ? "99" : Math.round(value)}% of the bills your history predicts. Tick = flag line.`
      : `Lower than ${Math.round(Math.min(100 - value, 99.9))}% of the bills your history predicts.`;
  return (
    <figure className="flex flex-col items-center" aria-label={`Percentile ${ordinal(value)}. ${caption}`}>
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
        <line x1={50 + (R - 7) * Math.cos(ang)} y1={50 + (R - 7) * Math.sin(ang)} x2={50 + (R + 7) * Math.cos(ang)} y2={50 + (R + 7) * Math.sin(ang)} stroke="var(--color-ink)" strokeWidth="1.6" strokeLinecap="round" />
        <text x="50" y="50" textAnchor="middle" className="num" fontSize="19" fontWeight="700" fill="var(--color-ink)">
          {ordinal(value)}
        </text>
        <text x="50" y="63" textAnchor="middle" fontSize="7" fontWeight="600" fill="var(--color-ink-3)" letterSpacing="0.6">
          PERCENTILE
        </text>
      </svg>
      <figcaption className="mt-1 max-w-[13rem] text-center text-xs leading-snug text-ink-3">{caption}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ conversions */
function ConversionTable({ data }: { data: ResultData }) {
  const r = data.result;
  const d = data.current.days;
  const cols = [
    { label: `This bill (${days(d)} days)`, f: (perDay: number) => perDay * d },
    { label: "Per day", f: (perDay: number) => perDay },
    { label: "Per hour", f: (perDay: number) => perDay / 24 },
  ];
  const rows = [
    { label: "Actual", perDay: r.actualPerDay, cls: "text-ink" },
    { label: "AI expected", perDay: r.expectedPerDay, cls: "text-blue" },
    { label: "Difference", perDay: r.actualPerDay - r.expectedPerDay, cls: r.residualKwh >= 0 ? "text-amber" : "text-blue" },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[26rem] text-sm">
        <caption className="sr-only">This bill as daily and hourly amounts</caption>
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="py-2 pr-3 font-semibold" scope="col">
              kWh
            </th>
            {cols.map((c) => (
              <th key={c.label} className="py-2 pl-3 text-right font-semibold" scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="num divide-y divide-line">
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className="py-2 pr-3 text-left font-semibold text-ink-2">
                {row.label}
              </th>
              {cols.map((c) => {
                const v = c.f(row.perDay);
                return (
                  <td key={c.label} className={`py-2 pl-3 text-right font-semibold ${row.cls}`}>
                    {row.label === "Difference" && v > 0 ? "+" : ""}
                    {Math.abs(v) < 10 ? k2(v) : k1(v)} kWh
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-3">1 kWh = 1 “unit” on your electricity bill = 1,000 Wh. Daily amounts let bills with different numbers of days compare fairly.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ why: history chart */
function HistoryChart({ data }: { data: ResultData }) {
  const reduce = useReduceMotion();
  const r = data.result;
  const yearAgoMonth = r.fit.seasonal?.month;
  const pts = [...data.history].sort((a, b) => a.month.localeCompare(b.month)).map((b) => ({ month: b.month, perDay: b.kwh / b.days, current: false }));
  pts.push({ month: data.month, perDay: r.actualPerDay, current: true });
  const lo = Math.max(0, r.expectedPerDay - 2 * r.fit.sigma);
  const hi = r.expectedPerDay + 2 * r.fit.sigma;
  const max = Math.max(hi, ...pts.map((p) => p.perDay)) * 1.1;
  const y = (v: number) => 100 - (v / max) * 100;
  return (
    <figure aria-label={`Daily use for each month. Normal range for ${monthName(data.month)}: ${k1(lo)} to ${k1(hi)} kWh per day.`}>
      <div className="relative h-48">
        <div aria-hidden className="absolute inset-x-0 rounded-md bg-sage-soft" style={{ top: `${y(hi)}%`, height: `${y(lo) - y(hi)}%` }} />
        <div aria-hidden className="absolute inset-x-0 border-t-2 border-dashed border-blue/70" style={{ top: `${y(r.expectedPerDay)}%` }} />
        <div className="absolute inset-0 flex items-end gap-2 px-1">
          {pts.map((p, i) => (
            <div key={p.month} className="flex h-full flex-1 flex-col items-center justify-end">
              <motion.div
                className={`w-full max-w-12 origin-bottom rounded-t-lg ${
                  p.current ? (r.flagged ? "bg-amber-bright" : r.low ? "bg-blue-bright" : "bg-ink") : p.month === yearAgoMonth ? "bg-blue-bright/60 ring-2 ring-blue" : "bg-ink-3/45"
                }`}
                style={{ height: `${100 - y(p.perDay)}%` }}
                initial={reduce ? false : { scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ ...SPRING, delay: 0.2 + i * 0.06 }}
                title={`${monthName(p.month)}: ${k1(p.perDay)} kWh/day`}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-2 px-1">
        {pts.map((p) => (
          <span key={p.month} className={`flex-1 text-center text-[11px] ${p.current ? "font-bold text-ink" : "text-ink-3"}`}>
            {monthShort(p.month)}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-ink-3/45" /> Past months (kWh/day)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-blue" /> AI expected: {k1(r.expectedPerDay)} kWh/day
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-sage-soft ring-1 ring-sage/30" /> Normal range ({k1(lo)}–{k1(hi)})
        </span>
        {yearAgoMonth && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-blue-bright/60 ring-2 ring-blue" /> Same month last year ({monthShort(yearAgoMonth)})
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function WhyPanel({ data }: { data: ResultData }) {
  const { facts, possible } = explainBill(data);
  const f = data.result.fit;
  return (
    <section className="surface px-5 py-6 sm:px-8 sm:py-7" aria-labelledby="why-title">
      <h3 id="why-title" className="text-xl font-bold text-ink">
        Why this result?
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        WATTWISE learned your normal from your {f.n} past bills (
        {f.method === "seasonal" ? `the same month last year, adjusted for your recent level` : f.method === "trend" ? "a trend line" : "their average"}), then
        checked whether {monthName(data.month)} falls inside your usual range.
      </p>
      <div className="mt-6">
        <HistoryChart data={data} />
      </div>
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-bold text-ink">What WATTWISE found</h4>
          <ul className="mt-2 space-y-2">
            {facts.map((x) => (
              <li key={x} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-sunken/70 p-4">
          <h4 className="text-sm font-bold text-ink">Possible explanations to consider</h4>
          <ul className="mt-2 space-y-2">
            {possible.map((x) => (
              <li key={x} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-sage-bright" />
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-3">WATTWISE can’t see devices or people, so these are possibilities, not diagnoses.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ energy flow */
function Connector({ index, reduce }: { index: number; reduce: boolean }) {
  const draw = reduce ? {} : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { delay: 0.35 + index * 0.18, duration: 0.35 } };
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
  const neg = r.residualKwh < 0;
  const diff = Math.abs(r.residualKwh);
  const cost = costOf(diff * 1000, tariff);
  const n = data.actions.length;
  const tone = k === "unusual" ? "amber" : k === "low" ? "blue" : "sage";
  const nodes = [
    { key: "used", value: `${k1(data.current.kwh)} kWh`, label: "used this bill", tone: "ink" },
    { key: "expected", value: `${k1(r.expectedKwh)} kWh`, label: "expected from your history", tone: "blue" },
    { key: "diff", value: `${neg ? "−" : "+"}${k1(diff)} kWh`, label: k === "unusual" ? "potential excess" : neg ? "less than expected" : "above expected (normal range)", tone },
    {
      key: "cost",
      value: cost === null || !tariff ? "Set tariff" : fmtMoney(cost, tariff.currency),
      label: cost === null ? "to estimate cost" : k === "unusual" ? "possible excess cost" : neg ? "less than expected cost" : "cost of the difference",
      tone,
      href: cost === null ? "/settings/" : undefined,
    },
    { key: "checks", value: String(n), label: n ? `thing${n === 1 ? "" : "s"} worth checking` : "nothing to check", tone: "sage" },
  ];
  const toneCls: Record<string, string> = { ink: "bg-surface text-ink", blue: "bg-blue-soft text-blue", amber: "bg-amber-soft text-amber", sage: "bg-sage-soft text-sage-strong" };
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
export function ActionList({ actions, checks, onToggle }: { actions: ActionItem[]; checks?: Record<string, string>; onToggle?: (id: string) => void }) {
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
  const v = verdict(data);
  const neg = r.residualKwh < 0;
  const diff = Math.abs(r.residualKwh);
  const cost = costOf(diff * 1000, tariff);
  const status = k === "unusual" ? "unusual" : k === "low" ? "below" : "normal";
  const stats = [
    { k: "Difference", v: `${neg ? "−" : "+"}${k1(diff)} kWh`, sub: `${neg ? "below" : "above"} expected`, tone: k === "unusual" ? "text-amber" : neg ? "text-blue" : "text-ink" },
    {
      k: neg ? "Below expected" : "Potential excess",
      v: `${k1(k === "unusual" ? r.potentialExcessKwh : diff)} kWh`,
      sub: k === "unusual" ? "counted as potential excess" : neg ? "no excess" : "normal variation, not counted",
      tone: k === "unusual" ? "text-amber" : neg ? "text-blue" : "text-ink",
    },
    {
      k: neg ? "Cost below expected" : "Estimated potential cost",
      v: cost === null || !tariff ? "No tariff set" : fmtMoney(cost, tariff.currency),
      sub: tariff ? `${k1(diff)} kWh × ${fmtMoney(tariff.perKwh, tariff.currency)}` : "",
      tone: k === "unusual" ? "text-amber" : "text-ink",
    },
    { k: "Percentile", v: ordinal(Math.min(r.percentile, 99)), sub: "flag line ≈ 98th", tone: k === "unusual" ? "text-amber" : "text-ink" },
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
            k === "unusual" ? "bg-gradient-to-b from-amber-soft/70 to-transparent" : k === "low" ? "bg-gradient-to-b from-blue-soft/70 to-transparent" : "bg-gradient-to-b from-sage-soft/60 to-transparent"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            {data.source === "demo" && <SourceBadge />}
            <span className="text-sm text-ink-3">
              {monthName(data.month)} · {days(data.current.days)} days
            </span>
          </div>
          <h2 id="verdict" className="mt-4 text-[1.75rem] font-bold leading-tight text-ink sm:text-[2.2rem]">
            {v.title}
          </h2>
          <p className="mt-2 max-w-2xl text-ink-2">{v.sub}</p>
        </div>
        <div className="grid gap-8 px-6 pb-6 sm:px-9 md:grid-cols-[1fr_auto] md:items-center">
          <CompareBars
            actual={data.current.kwh}
            expected={r.expectedKwh}
            flagged={r.flagged}
            actualLabel={`${monthName(data.month)}, from your bill`}
            expectedLabel={`for ${days(data.current.days)} days, learned from your past bills`}
          />
          <PercentileRing data={data} />
        </div>
        <div className="border-t border-line px-6 py-5 sm:px-9">
          <ConversionTable data={data} />
        </div>
        <dl className="grid grid-cols-2 border-t border-line sm:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.k} className={`px-6 py-5 sm:px-7 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
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
          Only bills flagged as unusual count toward your potential excess and savings totals. Cost = kWh × your tariff
          {tariff ? ` (${fmtMoney(tariff.perKwh, tariff.currency)}/kWh)` : ""}. These are estimates, not measured savings.
        </p>
      </section>

      <section className="surface px-5 py-6 sm:px-8 sm:py-7" aria-labelledby="checks-title">
        <h3 id="checks-title" className="text-xl font-bold text-ink">
          What should I check?
        </h3>
        {data.actions.length ? (
          <>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">These are investigation suggestions. WATTWISE doesn’t know which device used the extra energy.</p>
            <div className="mt-5">
              <ActionList actions={data.actions} checks={checks} onToggle={onToggleAction} />
            </div>
          </>
        ) : (
          <p className="mt-2 leading-relaxed text-ink-2">
            {neg ? "Nothing to investigate: this bill is below what your history suggests." : "Nothing unusual to investigate this month."} WATTWISE suggests
            checks only when a bill is flagged as unusually high.
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-sunken/60 px-5 py-6 sm:px-8" aria-labelledby="how-title">
        <h3 id="how-title" className="flex items-center gap-2 font-bold text-ink">
          <IconFlask size={18} className="text-blue" /> Bills used
        </h3>
        <ul className="mt-4 flex flex-wrap gap-2">
          {[...data.history]
            .sort((a, b) => a.month.localeCompare(b.month))
            .map((b) => (
              <li key={b.month} className="rounded-2xl bg-surface px-3.5 py-2 text-sm">
                <span className="font-semibold text-ink">{monthShort(b.month)}</span>{" "}
                <span className="num text-ink-2">
                  {k1(b.kwh)} kWh · {k1(b.kwh / b.days)}/day
                </span>
              </li>
            ))}
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-ink-2">
          {r.fit.method === "seasonal" && r.fit.seasonal
            ? `WATTWISE compared against ${monthName(r.fit.seasonal.month)}, scaled by how your last 3 months compare with a year earlier (×${r.fit.seasonal.levelRatio.toFixed(2)}).`
            : r.fit.method === "trend"
              ? `With ${r.fit.n} months of history, WATTWISE fitted a trend line to your daily use (least squares) and extended it to ${monthName(data.month)}. Add last year’s same month to account for seasons.`
              : `With ${r.fit.n} months of history, WATTWISE uses your average daily use. From 6 months it learns your trend, and with last year’s same month it accounts for seasons.`}{" "}
          Usual variation is ±{k1(r.fit.sigma)} kWh/day: your bills’ own spread, blended with a typical 10% household variation when there are few bills, and widened
          for a short history. A bill is flagged at 2× that above expected. Everything ran in this browser.
        </p>
      </section>

      {footer}
    </div>
  );
}

export function MiniCompare({ actual, expected, flagged }: { actual: number; expected: number; flagged: boolean }) {
  const max = Math.max(actual, expected, 0.001);
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
