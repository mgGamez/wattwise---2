"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import type { Point } from "@/lib/types";
import { fmtClock } from "@/lib/format";
import { EASE, useReducedMotionSafe } from "./motion";

/**
 * Lightweight SVG context chart (no chart library): actual vs AI-expected
 * around one interval, with the residual drawn as an amber bar.
 * Lines use a stretched viewBox; markers are HTML overlays so they never distort.
 */
export function MiniChart({
  points,
  focus,
  height = 160,
  label,
  focusTone = "unexpected",
}: {
  points: Point[];
  focus: string;
  height?: number;
  label: string;
  focusTone?: "unexpected" | "expected";
}) {
  const reduce = useReducedMotionSafe();
  // Visibility is observed on the unclipped wrapper: a fully clipped element
  // never reports as intersecting in Chromium.
  const wrapRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapRef, { once: true, amount: 0.4 });
  if (!points.length) return null;

  const W = 600;
  const H = 100;
  const max = Math.max(...points.map((p) => Math.max(p.actual, p.expected))) * 1.12;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - (v / max) * H;
  const path = (key: "actual" | "expected") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const fi = Math.max(0, points.findIndex((p) => p.t === focus));
  const f = points[fi];
  const leftPct = (fi / (points.length - 1)) * 100;
  const topActual = (y(f.actual) / H) * 100;
  const topExpected = (y(f.expected) / H) * 100;
  const tone = focusTone === "unexpected" ? "unexpected" : "expected";

  // Lines are revealed left-to-right with a clip-path (works with the
  // stretched viewBox and keeps the expected line's dash pattern intact).
  const reveal = reduce
    ? {}
    : {
        initial: { clipPath: "inset(0 100% 0 0)" },
        animate: { clipPath: inView ? "inset(0 0% 0 0)" : "inset(0 100% 0 0)" },
        transition: { duration: 0.9, ease: EASE },
      };

  return (
    <figure className="w-full">
      <div ref={wrapRef} className="relative w-full" style={{ height }} role="img" aria-label={label}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={0} x2={W} y1={H * g} y2={H * g} stroke="rgb(255 255 255 / 0.05)" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <motion.div key={`lines-${reduce}`} className="absolute inset-0" {...reveal}>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="size-full overflow-visible">
            <path
              d={path("expected")}
              fill="none"
              stroke="var(--color-expected)"
              strokeWidth={1.75}
              strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={path("actual")}
              fill="none"
              stroke="var(--color-actual)"
              strokeWidth={1.75}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </motion.div>
        {/* residual bar */}
        <div
          aria-hidden
          className={`absolute w-[3px] -translate-x-1/2 rounded-full ${tone === "unexpected" ? "bg-unexpected/70" : "bg-expected/70"}`}
          style={{
            left: `${leftPct}%`,
            top: `${Math.min(topActual, topExpected)}%`,
            height: `${Math.abs(topExpected - topActual)}%`,
          }}
        />
        <span
          aria-hidden
          className={`absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
            tone === "unexpected" ? "border-unexpected bg-unexpected/30" : "border-expected bg-expected/30"
          }`}
          style={{ left: `${leftPct}%`, top: `${topActual}%` }}
        />
        <span
          aria-hidden
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-expected"
          style={{ left: `${leftPct}%`, top: `${topExpected}%` }}
        />
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-ink-3 num">
        <span>{fmtClock(points[0].t)}</span>
        <span>{fmtClock(f.t)}</span>
        <span>{fmtClock(points[points.length - 1].t)}</span>
      </figcaption>
    </figure>
  );
}
