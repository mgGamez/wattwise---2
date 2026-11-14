"use client";

import { motion } from "framer-motion";
import { BarChart, LineChart } from "@/components/charts";
import { CATEGORY_ICON, IconArrowRight, IconFlask } from "@/components/icons";
import { AnimatedNumber, EASE, SPRING, useReduceMotion } from "@/components/motion";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { allTimeTotal, byMonth, checksProgress, periodTotals, statusOf } from "@/lib/insights";
import { monthName, monthShort } from "@/lib/explain";
import { costOf, fmtKwh, fmtMoney, fmtNum } from "@/lib/money";
import { useAppState } from "@/lib/storage";

export default function InsightsPage() {
  const state = useAppState()!;
  const reduce = useReduceMotion();
  const analyses = state.analyses;

  if (!analyses.length) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Insights" title="Savings & patterns" />
        <EmptyState
          title="Keep analyzing bills to build your savings picture."
          body="Savings and trends are calculated only from the bills you analyze and save. Nothing is estimated for months you haven’t analyzed."
        >
          <ButtonLink href="/analyze/">
            Analyze a bill <IconArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="/analyze/?demo=1" variant="secondary">
            <IconFlask size={18} className="text-blue" /> Try with example bills
          </ButtonLink>
        </EmptyState>
        <ReduceInfographic />
      </div>
    );
  }

  const total = allTimeTotal(analyses);
  const periods = periodTotals(analyses);
  const progress = checksProgress(analyses, state.actions);
  const sorted = [...analyses].sort(byMonth);
  const labels = sorted.map((a) => monthName(a.month));
  const tariff = state.tariff;
  const money = (kwh: number) => (tariff ? fmtMoney(costOf(kwh * 1000, tariff)!, tariff.currency) : "—");
  let running = 0;
  const cumulativeCost = sorted.map((a) => {
    running += costOf(a.result.potentialExcessKwh * 1000, tariff) ?? 0;
    return running;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Savings & patterns"
        sub="Calculated only from the analyses saved in this browser."
      />

      {/* Potential excess hero */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={SPRING}
        className="surface overflow-hidden"
        aria-labelledby="excess-title"
      >
        <div className="grid gap-6 bg-gradient-to-br from-amber-soft/70 via-surface to-sage-soft/50 p-6 sm:grid-cols-2 sm:p-8">
          <div>
            <p id="excess-title" className="label-caps">
              Potential excess identified
            </p>
            <p className="num mt-3 text-5xl font-bold leading-none text-amber">
              <AnimatedNumber value={total.excessKwh * 1000} format={fmtKwh} />
            </p>
            <p className="mt-2 text-sm text-ink-2">
              {total.flagged} unusual of {total.count} saved bill{total.count === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="label-caps">Estimated potential cost</p>
            <p className="num mt-3 text-5xl font-bold leading-none text-ink">
              {tariff ? <AnimatedNumber value={costOf(total.excessKwh * 1000, tariff)!} format={(v) => fmtMoney(v, tariff.currency)} /> : "—"}
            </p>
            <p className="mt-2 text-sm text-ink-2">{tariff ? `at ${fmtMoney(tariff.perKwh, tariff.currency)} per kWh` : "Set a tariff in Settings."}</p>
          </div>
        </div>
        <div className="border-t border-line p-6 sm:p-8">
          {periods.length ? (
            <ul className="grid gap-3 sm:grid-cols-3">
              {periods.map((p, i) => (
                <motion.li
                  key={p.key}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING, delay: 0.1 + i * 0.06 }}
                  className="rounded-2xl bg-sunken px-5 py-4"
                >
                  <p className="text-sm font-semibold text-ink-2">{p.label}</p>
                  <p className="num mt-1 text-2xl font-bold text-ink">{fmtKwh(p.excessKwh * 1000)}</p>
                  <p className="num text-sm text-ink-2">
                    {money(p.excessKwh)} · {p.count} bill{p.count === 1 ? "" : "s"}
                  </p>
                </motion.li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-2">
              None of your saved readings are from today, the last 7 days or this month (held-out test examples are dated 2016), so only the
              all-time total is shown.
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            Potential excess = actual − expected, counted only for readings flagged as unusual. Cost = kWh × your tariff. These are
            estimates of what may be avoidable, not measured savings. Periods use reading times.
          </p>
        </div>
      </motion.section>

      {/* Investigation progress */}
      {progress.total > 0 && (
        <section className="surface flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:p-7" aria-labelledby="checks-title">
          <div className="flex-1">
            <h2 id="checks-title" className="font-bold text-ink">
              Suggested checks completed
            </h2>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-sunken">
              <motion.div
                className="h-full origin-left rounded-full bg-sage"
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: progress.done / progress.total }}
                transition={{ duration: 0.9, ease: EASE }}
              />
            </div>
          </div>
          <p className="num text-2xl font-bold text-ink">
            {progress.done}/{progress.total}
          </p>
        </section>
      )}

      {/* Trends */}
      {sorted.length < 2 ? (
        <p className="surface px-6 py-8 text-center text-ink-2">Analyze at least two bills to see trends.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title="Actual vs expected" note="kWh per day for each saved bill, in month order. Amber = unusually high." wide>
            <LineChart
              labels={labels}
              series={[
                { key: "a", label: "Actual", color: "var(--color-ink)", values: sorted.map((a) => a.result.actualPerDay) },
                { key: "e", label: "AI expected", color: "var(--color-blue)", dashed: true, values: sorted.map((a) => a.result.expectedPerDay) },
              ]}
              markers={sorted.map((a) => a.result.flagged)}
              format={(v) => `${fmtNum(v, 1)} kWh/day`}
              ariaLabel={`Actual versus expected daily use for ${sorted.length} saved bills`}
            />
          </ChartCard>
          <ChartCard title="Potential excess per bill">
            <BarChart
              labels={labels}
              values={sorted.map((a) => a.result.potentialExcessKwh)}
              colors={sorted.map((a) => (a.result.flagged ? "var(--color-amber-bright)" : "var(--color-sage-bright)"))}
              format={(v) => `${fmtNum(v, 1)} kWh potential excess`}
              ariaLabel="Potential excess for each saved bill"
            />
          </ChartCard>
          {tariff && (
            <ChartCard title="Estimated cost, cumulative">
              <LineChart
                labels={labels}
                area
                height={180}
                series={[{ key: "c", label: "Cumulative potential cost", color: "var(--color-sage)", values: cumulativeCost }]}
                format={(v) => fmtMoney(v, tariff.currency)}
                ariaLabel="Cumulative estimated cost of potential excess"
              />
            </ChartCard>
          )}
          <ChartCard title="Recent pattern" note="Your saved bills in month order. Look for clusters of amber.">
            <ol className="flex flex-wrap gap-1.5" aria-label="Saved bills, oldest first">
              {sorted.slice(-30).map((a) => (
                <li
                  key={a.id}
                  title={monthShort(a.month)}
                  className={`size-5 rounded-md ${statusOf(a) === "unusual" ? "bg-amber-bright" : statusOf(a) === "below" ? "bg-blue-bright" : "bg-sage-bright"}`}
                  aria-label={`${labels[sorted.indexOf(a)]}: ${a.result.flagged ? "unusual" : "normal"}`}
                />
              ))}
            </ol>
          </ChartCard>
        </div>
      )}

      <ReduceInfographic />
    </div>
  );
}

function ChartCard({ title, note, wide, children }: { title: string; note?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <section className={`surface p-6 ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="font-bold text-ink">{title}</h2>
      {note && <p className="mt-0.5 text-sm text-ink-3">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/* ---------------------------------------------------------------- education */
const LOOP = [
  { title: "Detect unusual periods", body: "WATTWISE compares each reading with what it expected." },
  { title: "Check what was operating", body: "Use the suggested checks for that time of day." },
  { title: "Adjust schedules or settings", body: "Timers, thermostats, standby, equipment use." },
  { title: "Measure again", body: "Analyze the same time of day after the change." },
  { title: "Track the change", body: "Watch potential excess fall in your history." },
];

const AREAS = [
  { key: "cooling-heating", label: "Cooling & heating" },
  { key: "lighting", label: "Lighting" },
  { key: "standby", label: "Standby electronics" },
  { key: "high-load", label: "High-load equipment" },
  { key: "timing", label: "Timing & schedules" },
] as const;

function ReduceInfographic() {
  const reduce = useReduceMotion();
  return (
    <section className="surface overflow-hidden p-6 sm:p-8" aria-labelledby="reduce-title">
      <p className="label-caps">Guide</p>
      <h2 id="reduce-title" className="mt-1 text-2xl font-bold text-ink">
        How to reduce unnecessary energy use
      </h2>
      <ol className="mt-7 grid gap-3 md:grid-cols-5">
        {LOOP.map((s, i) => (
          <motion.li
            key={s.title}
            initial={reduce ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ ...SPRING, delay: i * 0.08 }}
            className="relative rounded-2xl bg-sunken p-4"
          >
            <span className="grid size-8 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
            <h3 className="mt-3 font-bold leading-snug text-ink">{s.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{s.body}</p>
            {i < LOOP.length - 1 && (
              <svg aria-hidden className="absolute -right-3 top-6 z-10 hidden md:block" width="18" height="12" viewBox="0 0 18 12">
                <path d="M1 6 H15 M11 2 L15 6 L11 10" fill="none" stroke="var(--color-sage)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </motion.li>
        ))}
      </ol>
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-3">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4" />
        </svg>
        Then repeat: each cycle builds a clearer picture of normal.
      </p>
      <h3 className="mt-8 font-bold text-ink">Common areas worth checking</h3>
      <ul className="mt-4 flex flex-wrap gap-3">
        {AREAS.map(({ key, label }, i) => {
          const Icon = CATEGORY_ICON[key];
          return (
            <motion.li
              key={key}
              initial={reduce ? false : { opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ ...SPRING, delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-2.5 rounded-full border border-line bg-canvas py-2 pl-2 pr-4 text-sm font-semibold text-ink"
            >
              <span className="grid size-8 place-items-center rounded-full bg-sage-soft text-sage-strong">
                <Icon size={18} />
              </span>
              {label}
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-ink-3">WATTWISE can’t see individual appliances, so it doesn’t estimate how much each area contributes.</p>
    </section>
  );
}

