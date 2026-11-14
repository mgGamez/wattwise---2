"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { MiniCompare } from "@/components/result";
import { IconArrowRight, IconChevron, IconFlask, IconTrash } from "@/components/icons";
import { SPRING, useReduceMotion } from "@/components/motion";
import { Button, ButtonLink, ConfirmInline, EmptyState, PageHeader, Segmented, SourceBadge, StatusPill } from "@/components/ui";
import { statusOf } from "@/lib/insights";
import { costOf, fmtKwh, fmtMoney, fmtNum } from "@/lib/money";
import { monthName } from "@/lib/explain";
import { clearAnalyses, deleteAnalysis, useAppState, type Analysis } from "@/lib/storage";
import { fmtRelative } from "@/lib/time";

type Filter = "all" | "unusual" | "normal" | "demo";
type Sort = "newest" | "oldest" | "excess" | "recent";

const SORTS: Record<Sort, { label: string; fn: (a: Analysis, b: Analysis) => number }> = {
  newest: { label: "Newest month", fn: (a, b) => b.month.localeCompare(a.month) },
  oldest: { label: "Oldest month", fn: (a, b) => a.month.localeCompare(b.month) },
  excess: { label: "Largest potential excess", fn: (a, b) => b.result.potentialExcessKwh - a.result.potentialExcessKwh || b.result.residualKwh - a.result.residualKwh },
  recent: { label: "Recently analyzed", fn: (a, b) => b.createdAt.localeCompare(a.createdAt) },
};

export default function HistoryPage() {
  const state = useAppState()!;
  const reduce = useReduceMotion();
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const list = useMemo(() => {
    const f = state.analyses.filter((a) =>
      filter === "all" ? true : filter === "unusual" ? a.result.flagged : filter === "normal" ? !a.result.flagged : a.source === "demo",
    );
    return f.sort(SORTS[sort].fn);
  }, [state.analyses, filter, sort]);

  if (!state.analyses.length) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="History" title="Your analyses" />
        <EmptyState title="Nothing saved yet" body="Bills you analyze and save appear here, stored only in this browser.">
          <ButtonLink href="/analyze/">
            Analyze a bill <IconArrowRight size={18} />
          </ButtonLink>
          <ButtonLink href="/analyze/?demo=pick" variant="secondary">
            <IconFlask size={18} className="text-blue" /> Try with example bills
          </ButtonLink>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="History"
        title="Your analyses"
        sub={`${state.analyses.length} saved in this browser.`}
        aside={
          !confirmClear ? (
            <Button variant="ghost" onClick={() => setConfirmClear(true)}>
              <IconTrash size={18} /> Clear history
            </Button>
          ) : (
            <ConfirmInline
              prompt={`Delete all ${state.analyses.length} analyses?`}
              confirmLabel="Delete all"
              onConfirm={() => {
                clearAnalyses();
                setConfirmClear(false);
              }}
              onCancel={() => setConfirmClear(false)}
            />
          )
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "unusual", label: "Unusual" },
            { value: "normal", label: "Normal" },
            { value: "demo", label: "Demo" },
          ]}
        />
        <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">
          Sort
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-10 cursor-pointer rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink"
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <p className="surface px-6 py-10 text-center text-ink-2">No analyses match this filter.</p>
      ) : (
        <ul className="space-y-3" aria-label="Saved analyses">
          <AnimatePresence initial={false}>
            {list.map((a, i) => {
              const cost = costOf(a.result.potentialExcessKwh * 1000, state.tariff);
              return (
                <motion.li
                  key={a.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { ...SPRING, delay: Math.min(i, 8) * 0.03 } }}
                  exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
                  className="surface overflow-hidden"
                >
                  <div className="flex items-center gap-2 pr-2 sm:pr-4">
                    <Link
                      href={`/analysis/?id=${a.id}`}
                      className="tap flex min-w-0 flex-1 flex-col gap-3 px-5 py-4 hover:bg-sunken/50 sm:flex-row sm:items-center sm:gap-6 sm:px-6"
                    >
                      <span className="min-w-0 sm:w-64">
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusPill status={statusOf(a)} size="sm" />
                          {a.source === "demo" && <SourceBadge />}
                        </span>
                        <span className="mt-1.5 block truncate font-semibold text-ink">{monthName(a.month)}</span>
                        <span className="block text-xs text-ink-3">Analyzed {fmtRelative(a.createdAt)}</span>
                      </span>
                      <span className="w-full sm:w-40">
                        <MiniCompare actual={a.current.kwh} expected={a.result.expectedKwh} flagged={a.result.flagged} />
                        <span className="num mt-1.5 block text-xs text-ink-2">
                          {fmtNum(a.current.kwh)} kWh vs <span className="text-blue">{fmtNum(a.result.expectedKwh)} kWh</span>
                        </span>
                      </span>
                      <span className="grid flex-1 grid-cols-3 gap-3 text-sm">
                        <span>
                          <span className="block text-xs text-ink-3">Difference</span>
                          <span className="num font-semibold text-ink">{`${a.result.residualKwh >= 0 ? "+" : "−"}${fmtNum(Math.abs(a.result.residualKwh), 1)} kWh`}</span>
                        </span>
                        <span>
                          <span className="block text-xs text-ink-3">Excess</span>
                          <span className={`num font-semibold ${a.result.flagged ? "text-amber" : "text-ink"}`}>{fmtKwh(a.result.potentialExcessKwh * 1000)}</span>
                        </span>
                        <span>
                          <span className="block text-xs text-ink-3">Cost</span>
                          <span className="num font-semibold text-ink">{cost !== null && state.tariff ? fmtMoney(cost, state.tariff.currency) : "—"}</span>
                        </span>
                      </span>
                      <IconChevron size={18} className="hidden shrink-0 text-ink-3 sm:block" />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Delete analysis from ${monthName(a.month)}`}
                      onClick={() => setConfirmId(confirmId === a.id ? null : a.id)}
                      className="tap grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-danger-soft hover:text-danger"
                    >
                      <IconTrash size={18} />
                    </button>
                  </div>
                  <AnimatePresence>
                    {confirmId === a.id && (
                      <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-line">
                        <div className="px-5 py-3 sm:px-6">
                          <ConfirmInline
                            prompt="Delete this analysis?"
                            confirmLabel="Delete"
                            onConfirm={() => {
                              deleteAnalysis(a.id);
                              setConfirmId(null);
                            }}
                            onCancel={() => setConfirmId(null)}
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
