"use client";

import { useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import type { Point } from "@/lib/types";
import { fmtDayClock, fmtNum, fmtShortDate, fmtTimestamp, hourOf, minuteOf } from "@/lib/format";

const C = {
  actual: "#e9ebee",
  expected: "#7aa7ff",
  unexpected: "#ffb547",
  grid: "rgba(255,255,255,0.06)",
  tick: "#868d98",
};

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

type DotProps = { cx?: number; cy?: number; index?: number; payload?: Point };

function AnomalyDot({ cx, cy, index, payload }: DotProps) {
  if (!payload?.flagged || cx === undefined || cy === undefined) return <g key={`d-${index}`} />;
  return (
    <g key={`d-${index}`}>
      <circle cx={cx} cy={cy} r={9} fill={C.unexpected} fillOpacity={0.12} />
      <circle cx={cx} cy={cy} r={4.5} fill="#07080a" stroke={C.unexpected} strokeWidth={2} />
    </g>
  );
}

function ChartTooltip({ active, point }: { active?: boolean; point?: Point }) {
  if (!active || !point) return null;
  const diff = point.actual - point.expected;
  return (
    <div className="min-w-48 rounded-xl border border-line-strong bg-surface/95 px-4 py-3 text-sm shadow-2xl backdrop-blur">
      <p className="num text-xs text-ink-3">{fmtTimestamp(point.t)}</p>
      <dl className="mt-2 space-y-1">
        <div className="flex justify-between gap-6">
          <dt className="text-ink-2">Actual</dt>
          <dd className="num text-ink">{fmtNum(point.actual)} Wh</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-ink-2">AI expected</dt>
          <dd className="num text-expected">{fmtNum(point.expected)} Wh</dd>
        </div>
        <div className="flex justify-between gap-6 border-t border-line pt-1">
          <dt className="text-ink-2">Difference</dt>
          <dd className={`num ${point.flagged ? "text-unexpected" : "text-ink-2"}`}>
            {diff >= 0 ? "+" : "−"}
            {fmtNum(Math.abs(diff))} Wh
          </dd>
        </div>
      </dl>
      {point.flagged && <p className="mt-2 text-xs text-unexpected">Flagged: unexpected consumption</p>}
    </div>
  );
}

export default function ConsumptionChart({ points }: { points: Point[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const reduce = useReducedMotion();
  const compact = width > 0 && width < 640;
  const height = compact ? 300 : 400;

  // Day boundaries (and noon on wider screens) as ticks.
  const ticks = points
    .filter((p) => minuteOf(p.t) === 0 && (hourOf(p.t) === 0 || (!compact && hourOf(p.t) === 12)))
    .map((p) => p.t);

  return (
    <div ref={ref} className="w-full" style={{ height }}>
      {width > 0 && (
        <LineChart width={width} height={height} data={points} margin={{ top: 16, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis
            dataKey="t"
            ticks={ticks}
            interval={0}
            tickFormatter={(t: string) => (hourOf(t) === 0 ? fmtShortDate(t) : "12:00")}
            tick={{ fill: C.tick, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            width={44}
            tick={{ fill: C.tick, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => fmtNum(v)}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.18)", strokeWidth: 1 }}
            isAnimationActive={false}
            content={(p) => (
              <ChartTooltip active={p.active} point={(p.payload?.[0]?.payload as Point | undefined) ?? undefined} />
            )}
          />
          <Line
            type="linear"
            dataKey="expected"
            name="AI expected"
            stroke={C.expected}
            strokeWidth={1.6}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 3.5, fill: C.expected, stroke: "none" }}
            isAnimationActive={!reduce}
            animationDuration={1400}
            animationEasing="ease-out"
          />
          <Line
            type="linear"
            dataKey="actual"
            name="Actual"
            stroke={C.actual}
            strokeWidth={1.6}
            dot={(props: DotProps) => <AnomalyDot key={`d-${props.index}`} {...props} />}
            activeDot={{ r: 4, fill: C.actual, stroke: "#07080a", strokeWidth: 2 }}
            isAnimationActive={!reduce}
            animationDuration={1800}
            animationEasing="ease-out"
          />
        </LineChart>
      )}
      <span className="sr-only">{`Chart window ${fmtDayClock(points[0].t)} to ${fmtDayClock(points[points.length - 1].t)}.`}</span>
    </div>
  );
}
