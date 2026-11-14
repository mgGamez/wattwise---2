"use client";

import dynamic from "next/dynamic";
import { useInView } from "framer-motion";
import { useRef } from "react";
import type { SiteData } from "@/lib/types";
import { fmtDate, fmtNum, fmtTimestamp } from "@/lib/format";
import { Reveal } from "./motion";
import { LegendKey, Section, SectionHeader, Unavailable } from "./ui";

// Recharts is only downloaded when this section approaches the viewport.
const ConsumptionChart = dynamic(() => import("./ConsumptionChart"), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

function ChartSkeleton() {
  return <div aria-hidden className="h-[300px] w-full animate-pulse rounded-xl bg-white/[0.025] sm:h-[400px]" />;
}

export function ActualVsExpected({ chart, threshold }: { chart: SiteData["chart"]; threshold: number | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInView(ref, { once: true, margin: "200px 0px" });

  const flagged = chart?.points.filter((p) => p.flagged) ?? [];
  const biggest = flagged.reduce<(typeof flagged)[number] | null>(
    (b, p) => (!b || p.actual - p.expected > b.actual - b.expected ? p : b),
    null,
  );

  return (
    <Section id="chart" labelledBy="chart-title" className="border-t border-line">
      <SectionHeader
        id="chart-title"
        eyebrow="Actual vs AI expected"
        title="Seventy-two hours, interval by interval."
        lede={
          chart
            ? `Every 10-minute reading from ${fmtDate(chart.start)} to ${fmtDate(chart.end)}, part of the unseen test period. This is the 72-hour stretch with the most flagged intervals.`
            : undefined
        }
      />
      {!chart ? (
        <Unavailable what="The consumption chart" />
      ) : (
        <Reveal className="panel mt-12 p-4 pt-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 px-2 sm:px-0">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <LegendKey kind="actual" label="Actual" />
              <LegendKey kind="expected" label="AI expected" />
              <LegendKey kind="unexpected" label="Flagged as unexpected" />
            </div>
            <p className="num text-xs text-ink-3">Wh per 10-minute interval</p>
          </div>
          <figure
            ref={ref}
            className="mt-6"
            aria-label={`Line chart of actual and AI-expected consumption. ${chart.flaggedInWindow} intervals in this window were flagged as unexpected consumption${
              biggest ? `; the largest was ${fmtTimestamp(biggest.t)}, ${fmtNum(biggest.actual)} Wh actual vs ${fmtNum(biggest.expected)} Wh expected` : ""
            }.`}
          >
            {near ? <ConsumptionChart points={chart.points} /> : <ChartSkeleton />}
            <figcaption className="mt-5 flex flex-wrap gap-x-8 gap-y-2 px-2 text-sm text-ink-2 sm:px-0">
              <span>
                <span className="num text-unexpected">{chart.flaggedInWindow}</span> intervals flagged in this window
              </span>
              {threshold !== null && (
                <span>
                  Flag rule: actual − expected ≥ <span className="num text-ink">{fmtNum(threshold)} Wh</span>
                </span>
              )}
              <span className="text-ink-3">Hover or tap the line for exact values.</span>
            </figcaption>
          </figure>
        </Reveal>
      )}
    </Section>
  );
}
