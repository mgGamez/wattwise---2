"use client";

import { motion } from "framer-motion";
import { BarChart, LineChart } from "@/components/charts";
import { CATEGORY_ICON, IconArrowRight, IconFlask } from "@/components/icons";
import { AnimatedNumber, EASE, SPRING, useReduceMotion } from "@/components/motion";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui";
import { allTimeTotal, byHour, byReadingTime, checksProgress, periodTotals, statusOf } from "@/lib/insights";
import { costOf, fmtKwh, fmtMoney, fmtNum } from "@/lib/money";
import { useAppState } from "@/lib/storage";
import { fmtClock, fmtDay } from "@/lib/time";

export default function InsightsPage() {
  const state = useAppState()!;
  const reduce = useReduceMotion();
  const analyses = state.analyses;

  if (!analyses.length) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Insights" title="Savings & patterns" />
        <EmptyState
          title="Keep analyzing readings to build your savings picture."
          body="Savings, trends and time-of-day patterns are calculated only from analyses you save. Nothing is estimated for days you haven’t analyzed."
        >
          <ButtonLink href="/analyze/">
            Analyze a reading <IconArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="/analyze/?demo=pick" variant="secondary">
            <IconFlask size={18} className="text-blue" /> Try with demo data
          </ButtonLink>
        </EmptyState>
        <ReduceInfographic />
      </div>
    );
  }

  const total = allTimeTotal(analyses);
  const periods = periodTotals(analyses);
  const progress = checksProgress(analyses, state.actions);
  const sorted = [...analyses].sort(byReadingTime);
  const labels = sorted.map((a) => `${fmtDay(a.timestamp)} ${a.timestamp.slice(0, 4)} · ${fmtClock(a.timestamp)}`);
  const tariff = state.tariff;
  const money = (wh: number) => (tariff ? fmtMoney(costOf(wh, tariff)!, tariff.currency) : "—");
  let running = 0;
  const cumulativeCost = sorted.map((a) => {
    running += costOf(a.result.potentialExcessWh, tariff) ?? 0;
    return running;
  });
  const hours = byHour(analyses);

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
              <AnimatedNumber value={total.excessWh} format={fmtKwh} />
            </p>
            <p className="mt-2 text-sm text-ink-2">
              {total.flagged} unusual of {total.count} saved reading{total.count === 1 ? "" : "s"}
            </p>
          </div>
          <div>
            <p className="label-caps">Estimated potential cost</p>
            <p className="num mt-3 text-5xl font-bold leading-none text-ink">
              {tariff ? <AnimatedNumber value={costOf(total.excessWh, tariff)!} format={(v) => fmtMoney(v, tariff.currency)} /> : "—"}
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
                  <p className="num mt-1 text-2xl font-bold text-ink">{fmtKwh(p.excessWh)}</p>
                  <p className="num text-sm text-ink-2">
                    {money(p.excessWh)} · {p.count} reading{p.count === 1 ? "" : "s"}
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
        <p className="surface px-6 py-8 text-center text-ink-2">Analyze at least two readings to see trends.</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <ChartCard title="Actual vs expected" note="Each point is one saved reading, in reading-time order. Amber = unusual." wide>
            <LineChart
              labels={labels}
              series={[
                { key: "a", label: "Actual", color: "var(--color-ink)", values: sorted.map((a) => a.actualWh) },
                { key: "e", label: "AI expected", color: "var(--color-blue)", dashed: true, values: sorted.map((a) => a.result.expectedWh) },
              ]}
              markers={sorted.map((a) => a.result.flagged)}
              format={(v) => `${fmtNum(v)} Wh`}
              ariaLabel={`Actual versus expected for ${sorted.length} saved readings`}
            />
          </ChartCard>
          <ChartCard title="Potential excess per reading">
            <BarChart
              labels={labels}
              values={sorted.map((a) => a.result.potentialExcessWh)}
              colors={sorted.map((a) => (a.result.flagged ? "var(--color-amber-bright)" : "var(--color-sage-bright)"))}
              format={(v) => `${fmtNum(v)} Wh potential excess`}
              ariaLabel="Potential excess for each saved reading"
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
          <ChartCard title="Unusual readings by time of day" note="Bars show analyzed readings per hour; amber part = unusual.">
            <HourBars hours={hours} />
          </ChartCard>
          <ChartCard title="Recent pattern" note="Your last readings in order. Look for clusters of amber.">
            <ol className="flex flex-wrap gap-1.5" aria-label="Recent readings, oldest first">
              {sorted.slice(-30).map((a) => (
                <li
                  key={a.id}
                  title={labels[sorted.indexOf(a)]}
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

function HourBars({ hours }: { hours: ReturnType<typeof byHour> }) {
  const reduce = useReduceMotion();
  const max = Math.max(1, ...hours.map((h) => h.total));
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={hours.filter((h) => h.total).map((h) => `${h.hour}:00 ${h.flagged} of ${h.total} unusual`).join(", ")}>
        {hours.map((h, i) => (
          <div key={h.hour} className="flex h-full flex-1 flex-col justify-end" title={`${String(h.hour).padStart(2, "0")}:00 · ${h.flagged}/${h.total} unusual`}>
            <motion.div
              className="flex w-full origin-bottom flex-col justify-end overflow-hidden rounded-t-md bg-sage-soft"
              style={{ height: h.total ? `${(h.total / max) * 100}%` : "2px" }}
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.015 }}
            >
              <div className="w-full bg-amber-bright" style={{ height: h.total ? `${(h.flagged / h.total) * 100}%` : 0 }} />
            </motion.div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-ink-3">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
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

