"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { MiniCompare, PercentileRing } from "@/components/result";
import { IconArrowRight, IconBolt, IconChevron, IconFlask } from "@/components/icons";
import { AnimatedNumber, EASE, SPRING, useReduceMotion } from "@/components/motion";
import { ButtonLink, EmptyState, PrivacyNote, SourceBadge, StatusPill } from "@/components/ui";
import { allTimeTotal, byReadingTime, checksProgress, statusOf } from "@/lib/insights";
import { costOf, fmtKwh, fmtMoney, fmtNum } from "@/lib/money";
import { useAppState } from "@/lib/storage";
import { fmtRelative, fmtWhen, greeting } from "@/lib/time";

export default function Overview() {
  const state = useAppState()!;
  const reduce = useReduceMotion();
  const [hello, setHello] = useState("Hello.");
  useEffect(() => setHello(greeting()), []);

  const analyses = state.analyses;
  const header = (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[2.2rem] font-bold leading-[1.1] text-ink sm:text-[2.8rem]">{hello}</h1>
        <p className="mt-1 text-[1.35rem] font-semibold text-ink-2 sm:text-2xl">Here’s what WATTWISE sees.</p>
      </div>
      <ButtonLink href="/analyze/" size="lg">
        <IconBolt size={20} /> Analyze energy
      </ButtonLink>
    </header>
  );

  if (!analyses.length) {
    return (
      <div className="space-y-8">
        {header}
        <EmptyState
          title="No readings analyzed yet"
          body="Analyze a 10-minute reading to see what WATTWISE expected, how much looks unusual, and what it might cost. Or start with a real held-out test example."
        >
          <ButtonLink href="/analyze/">
            Analyze your first reading <IconArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="/analyze/?demo=pick" variant="secondary">
            <IconFlask size={18} className="text-blue" /> Try with demo data
          </ButtonLink>
        </EmptyState>
        <PrivacyNote />
      </div>
    );
  }

  const latest = [...analyses].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const total = allTimeTotal(analyses);
  const cost = costOf(total.excessWh, state.tariff);
  const recent = [...analyses].sort(byReadingTime).slice(-14);
  const recentUnusual = recent.filter((a) => a.result.flagged).length;
  const progress = checksProgress(analyses, state.actions);
  const lr = latest.result;

  return (
    <div className="space-y-6">
      {header}

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        {/* Latest analysis */}
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING}
          className={`surface relative overflow-hidden p-6 sm:p-8 ${lr.flagged ? "bg-gradient-to-br from-amber-soft/80 via-surface to-surface" : "bg-gradient-to-br from-sage-soft/70 via-surface to-surface"}`}
          aria-labelledby="latest-title"
        >
          <div className="flex flex-wrap items-center gap-2">
            <p id="latest-title" className="label-caps">
              Latest analysis
            </p>
            <StatusPill status={statusOf(latest)} size="sm" />
            {latest.source === "demo" && <SourceBadge />}
          </div>
          <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold leading-tight text-ink">
                {lr.flagged ? "Unusual consumption found" : statusOf(latest) === "below" ? "Much lower than expected" : "This reading looked normal"}
              </h2>
              <p className="mt-1 text-sm text-ink-3">{fmtWhen(latest.timestamp)}</p>
              <div className="mt-6 flex items-end gap-8">
                <div>
                  <p className="text-xs font-semibold text-ink-3">Actual</p>
                  <p className="num text-4xl font-bold text-ink">
                    <AnimatedNumber value={latest.actualWh} format={(v) => fmtNum(v)} />
                    <span className="ml-1 text-base text-ink-3">Wh</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-ink-3">AI expected</p>
                  <p className="num text-4xl font-bold text-blue">
                    <AnimatedNumber value={lr.expectedWh} format={(v) => fmtNum(v)} />
                    <span className="ml-1 text-base text-ink-3">Wh</span>
                  </p>
                </div>
              </div>
              <div className="mt-4 max-w-sm">
                <MiniCompare actual={latest.actualWh} expected={lr.expectedWh} flagged={lr.flagged} />
              </div>
            </div>
            <PercentileRing data={latest} size={128} />
          </div>
          <Link
            href={`/analysis/?id=${latest.id}`}
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink underline-offset-4 hover:underline"
          >
            Open full result <IconArrowRight size={16} />
          </Link>
        </motion.section>

        {/* Excess + cost */}
        <div className="grid gap-5">
          <motion.section
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.06 }}
            className="surface p-6"
            aria-labelledby="excess-title"
          >
            <p id="excess-title" className="label-caps">
              Potential excess detected
            </p>
            <p className="num mt-3 text-[2.6rem] font-bold leading-none text-amber">
              <AnimatedNumber value={total.excessWh} format={(v) => fmtKwh(v)} />
            </p>
            <p className="mt-2 text-sm text-ink-2">
              from {total.flagged} unusual reading{total.flagged === 1 ? "" : "s"} out of {total.count} analyzed
            </p>
          </motion.section>
          <motion.section
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING, delay: 0.12 }}
            className="surface p-6"
            aria-labelledby="cost-title"
          >
            <p id="cost-title" className="label-caps">
              Estimated cost impact
            </p>
            {cost !== null && state.tariff ? (
              <>
                <p className="num mt-3 text-[2.6rem] font-bold leading-none text-ink">
                  <AnimatedNumber value={cost} format={(v) => fmtMoney(v, state.tariff!.currency)} />
                </p>
                <p className="mt-2 text-sm text-ink-2">at {fmtMoney(state.tariff.perKwh, state.tariff.currency)} per kWh</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-2">
                <Link href="/settings/" className="font-semibold text-blue underline-offset-4 hover:underline">
                  Set your tariff
                </Link>{" "}
                to estimate cost.
              </p>
            )}
          </motion.section>
        </div>
      </div>

      {/* Recent anomaly status */}
      <motion.section
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING, delay: 0.16 }}
        className="surface p-6 sm:p-7"
        aria-labelledby="recent-title"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recent-title" className="font-bold text-ink">
            Recent anomaly status
          </h2>
          <p className="text-sm text-ink-2">
            <span className="num font-semibold text-amber">{recentUnusual}</span> unusual in your last {recent.length} reading
            {recent.length === 1 ? "" : "s"}
          </p>
        </div>
        <ol className="mt-5 flex flex-wrap items-end gap-2" aria-label="Recent readings, oldest to newest">
          {recent.map((a, i) => {
            const s = statusOf(a);
            const h = Math.max(14, Math.min(64, (a.actualWh / Math.max(...recent.map((x) => x.actualWh), 1)) * 64));
            return (
              <li key={a.id}>
                <Link
                  href={`/analysis/?id=${a.id}`}
                  title={`${fmtWhen(a.timestamp)}: ${s}`}
                  aria-label={`${fmtWhen(a.timestamp)}, ${fmtNum(a.actualWh)} Wh, ${s}`}
                  className="block"
                >
                  <motion.span
                    className={`block w-5 rounded-full sm:w-6 ${s === "unusual" ? "bg-amber-bright" : s === "below" ? "bg-blue-bright" : "bg-sage-bright"}`}
                    style={{ height: h }}
                    initial={reduce ? false : { scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ ...SPRING, delay: 0.2 + i * 0.03 }}
                  />
                </Link>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-bright" /> Unusual
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sage-bright" /> Normal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-bright" /> Below expected
          </span>
          <span>Bar height = actual use. Ordered by reading time.</span>
        </p>
      </motion.section>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        {/* History preview */}
        <section className="surface p-6 sm:p-7" aria-labelledby="hist-title">
          <div className="flex items-center justify-between">
            <h2 id="hist-title" className="font-bold text-ink">
              History
            </h2>
            <Link href="/history/" className="text-sm font-semibold text-blue underline-offset-4 hover:underline">
              View all {analyses.length}
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-line">
            {[...analyses]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 4)
              .map((a) => (
                <li key={a.id}>
                  <Link href={`/analysis/?id=${a.id}`} className="tap -mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-sunken">
                    <StatusPill status={statusOf(a)} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{fmtWhen(a.timestamp)}</span>
                      <span className="block text-xs text-ink-3">Analyzed {fmtRelative(a.createdAt)}</span>
                    </span>
                    <span className="num text-sm text-ink-2">
                      {fmtNum(a.actualWh)} / <span className="text-blue">{fmtNum(a.result.expectedWh)}</span> Wh
                    </span>
                    <IconChevron size={16} className="text-ink-3" />
                  </Link>
                </li>
              ))}
          </ul>
        </section>

        {/* Investigation progress */}
        <section className="surface p-6 sm:p-7" aria-labelledby="prog-title">
          <h2 id="prog-title" className="font-bold text-ink">
            Investigation progress
          </h2>
          {progress.total ? (
            <>
              <div className="mt-5 flex items-center gap-5">
                <ProgressRing done={progress.done} total={progress.total} />
                <p className="text-sm leading-relaxed text-ink-2">
                  <span className="num text-2xl font-bold text-ink">
                    {progress.done}/{progress.total}
                  </span>
                  <br />
                  suggested checks completed
                </p>
              </div>
              <Link href="/insights/" className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-blue underline-offset-4 hover:underline">
                Savings & patterns <IconArrowRight size={16} />
              </Link>
            </>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              No checks yet. WATTWISE suggests things to check whenever a reading is unusual.
            </p>
          )}
        </section>
      </div>
      <PrivacyNote compact />
    </div>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const reduce = useReduceMotion();
  return (
    <svg width="76" height="76" viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-sunken)" strokeWidth="5" />
      <motion.circle
        cx="20"
        cy="20"
        r="16"
        fill="none"
        stroke="var(--color-sage)"
        strokeWidth="5"
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: Math.max(done / total, 0.001) }}
        transition={{ duration: 0.9, ease: EASE }}
      />
    </svg>
  );
}
