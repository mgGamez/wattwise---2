"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Anomaly } from "@/lib/types";
import { fmtNum, fmtPercentile, fmtTimestamp } from "@/lib/format";
import { EASE, Reveal } from "./motion";
import { MiniChart } from "./MiniChart";
import { LegendKey, Section, SectionHeader, Unavailable } from "./ui";

type Sort = "largest" | "timeline";

export function AnomalyExplorer({ anomalies }: { anomalies: Anomaly[] | null }) {
  const [sort, setSort] = useState<Sort>("largest");
  const sorted = useMemo(() => {
    if (!anomalies) return [];
    const list = [...anomalies];
    return sort === "largest" ? list.sort((a, b) => b.residual - a.residual) : list.sort((a, b) => a.t.localeCompare(b.t));
  }, [anomalies, sort]);
  const [selectedT, setSelectedT] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const index = Math.max(0, sorted.findIndex((a) => a.t === selectedT));
  const current = sorted[index];

  const periodSize = useMemo(() => {
    const m = new Map<number, number>();
    anomalies?.forEach((a) => m.set(a.periodId, (m.get(a.periodId) ?? 0) + 1));
    return m;
  }, [anomalies]);

  if (!anomalies || anomalies.length === 0 || !current) {
    return (
      <Section id="explorer" labelledBy="explorer-title" className="border-t border-line">
        <SectionHeader id="explorer-title" eyebrow="Anomaly explorer" title="Every flagged interval" />
        <Unavailable what="The anomaly explorer" />
      </Section>
    );
  }

  const go = (i: number, focus = false) => {
    const next = sorted[(i + sorted.length) % sorted.length];
    setSelectedT(next.t);
    if (focus) {
      requestAnimationFrame(() => {
        const btn = listRef.current?.querySelector<HTMLButtonElement>(`[data-t="${next.t}"]`);
        btn?.focus();
        btn?.scrollIntoView({ block: "nearest" });
      });
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); go(index + 1, true); }
    if (e.key === "ArrowUp") { e.preventDefault(); go(index - 1, true); }
    if (e.key === "Home") { e.preventDefault(); go(0, true); }
    if (e.key === "End") { e.preventDefault(); go(sorted.length - 1, true); }
  };

  const size = periodSize.get(current.periodId) ?? 1;

  return (
    <Section id="explorer" labelledBy="explorer-title" className="border-t border-line">
      <SectionHeader
        id="explorer-title"
        eyebrow="Anomaly explorer"
        title={`All ${anomalies.length} flagged intervals from the test period.`}
        lede="Each one is real output from the model. Step through them to see how actual use compared with what the AI expected."
      />

      <Reveal className="mt-12">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label="Sort anomalies" className="flex rounded-full border border-line p-1">
            {(
              [
                ["largest", "Largest first"],
                ["timeline", "Timeline"],
              ] as [Sort, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                aria-pressed={sort === k}
                onClick={() => setSort(k)}
                className={`relative h-9 cursor-pointer rounded-full px-4 text-sm transition-colors ${sort === k ? "text-bg" : "text-ink-2 hover:text-ink"}`}
              >
                {sort === k && <motion.span layoutId="sort-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ duration: 0.3, ease: EASE }} />}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="num mr-2 text-sm text-ink-3" aria-hidden>
              {String(index + 1).padStart(2, "0")} / {sorted.length}
            </span>
            <NavButton label="Previous anomaly" onClick={() => go(index - 1)} dir="prev" />
            <NavButton label="Next anomaly" onClick={() => go(index + 1)} dir="next" />
          </div>
        </div>

        {/* Mobile picker */}
        <label className="mt-5 block lg:hidden">
          <span className="sr-only">Choose an anomaly</span>
          <select
            value={current.t}
            onChange={(e) => setSelectedT(e.target.value)}
            className="num h-12 w-full cursor-pointer appearance-none rounded-xl border border-line bg-surface px-4 text-sm text-ink"
          >
            {sorted.map((a, i) => (
              <option key={a.t} value={a.t}>
                {String(i + 1).padStart(2, "0")} · {fmtTimestamp(a.t)} · +{fmtNum(a.residual)} Wh
              </option>
            ))}
          </select>
        </label>

        <div className="mt-6 grid gap-4 lg:grid-cols-[19rem_1fr]">
          {/* Desktop list */}
          <div className="panel hidden overflow-hidden lg:block">
            <ul
              ref={listRef}
              aria-label="Flagged intervals"
              onKeyDown={onListKey}
              className="max-h-[33rem] space-y-0.5 overflow-y-auto p-2 [scrollbar-color:rgb(255_255_255/0.15)_transparent] [scrollbar-width:thin]"
            >
              {sorted.map((a, i) => {
                const active = a.t === current.t;
                return (
                  <li key={a.t}>
                    <button
                      type="button"
                      data-t={a.t}
                      aria-current={active ? "true" : undefined}
                      tabIndex={active ? 0 : -1}
                      onClick={() => setSelectedT(a.t)}
                      className={`relative flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        active ? "text-ink" : "text-ink-2 hover:bg-white/[0.03] hover:text-ink"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="anomaly-active"
                          className="absolute inset-0 rounded-lg border border-unexpected/30 bg-unexpected/[0.07]"
                          transition={{ duration: 0.3, ease: EASE }}
                        />
                      )}
                      <span className="relative flex items-center gap-2.5">
                        <span className="num w-5 text-xs text-ink-3">{i + 1}</span>
                        <span className="num">{fmtTimestamp(a.t).replace(" 2016", "")}</span>
                      </span>
                      <span className="num relative text-unexpected">+{fmtNum(a.residual)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Detail */}
          <div className="panel relative min-h-[28rem] p-6 sm:p-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.t}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="num text-sm text-ink">{fmtTimestamp(current.t)}</p>
                  <span className="inline-flex items-center gap-2 rounded-full border border-unexpected/40 bg-unexpected/10 px-3 py-1 text-xs text-unexpected">
                    <span aria-hidden className="size-1.5 rounded-full bg-unexpected" />
                    Unexpected consumption
                  </span>
                </div>

                <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
                  <Field label="AI expected" value={`${fmtNum(current.expected)} Wh`} tone="text-expected" />
                  <Field label="Actual" value={`${fmtNum(current.actual)} Wh`} tone="text-ink" />
                  <Field label="Residual" value={`+${fmtNum(current.residual)} Wh`} tone="text-unexpected" />
                  <Field label="Above expected" value={`+${fmtNum(current.pctAbove)}%`} tone="text-unexpected" />
                  <Field label="Anomaly percentile" value={fmtPercentile(current.percentile)} tone="text-ink" />
                  <Field
                    label="Flagged period"
                    value={size > 1 ? `${size} intervals` : "Single interval"}
                    tone="text-ink-2"
                  />
                </dl>

                <div className="mt-8">
                  <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2">
                    <LegendKey kind="actual" label="Actual" />
                    <LegendKey kind="expected" label="AI expected" />
                  </div>
                  <MiniChart
                    points={current.context}
                    focus={current.t}
                    height={170}
                    label={`Two hours either side of ${fmtTimestamp(current.t)}: actual ${fmtNum(current.actual)} Wh versus ${fmtNum(current.expected)} Wh expected.`}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
            <p className="sr-only" aria-live="polite">
              {`Anomaly ${index + 1} of ${sorted.length}: ${fmtTimestamp(current.t)}. Actual ${fmtNum(current.actual)} watt-hours, expected ${fmtNum(current.expected)}, ${fmtNum(current.pctAbove)} percent above expected.`}
            </p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

function Field({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className={`num mt-1.5 text-xl font-medium sm:text-2xl ${tone}`}>{value}</dd>
    </div>
  );
}

function NavButton({ label, onClick, dir }: { label: string; onClick: () => void; dir: "prev" | "next" }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 cursor-pointer place-items-center rounded-full border border-line text-ink-2 transition-colors hover:border-line-strong hover:text-ink active:scale-95"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-4">
        <path
          d={dir === "prev" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
