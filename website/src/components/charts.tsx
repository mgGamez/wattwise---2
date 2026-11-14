"use client";

// Lightweight SVG charts, built only from the user's saved analyses.
// Interactive: hover/tap or focus + arrow keys moves a readout over the points.

import { motion } from "framer-motion";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { EASE, useReduceMotion } from "./motion";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Series = { key: string; label: string; color: string; dashed?: boolean; values: number[] };

export function LineChart({
  labels,
  series,
  height = 220,
  format,
  ariaLabel,
  markers,
  area = false,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  format: (v: number) => string;
  ariaLabel: string;
  markers?: boolean[];
  area?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const reduce = useReduceMotion();
  const [idx, setIdx] = useState<number | null>(null);
  const n = labels.length;
  const padL = 8, padR = 8, padT = 12, padB = 26;
  const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.1;
  const x = (i: number) => padL + (n === 1 ? (width - padL - padR) / 2 : (i / (n - 1)) * (width - padL - padR));
  const y = (v: number) => padT + (1 - v / max) * (height - padT - padB);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setIdx((i) => Math.min(n - 1, (i ?? -1) + 1));
    if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, (i ?? n) - 1));
    if (e.key === "Escape") setIdx(null);
  };
  const onMove = (clientX: number) => {
    const el = ref.current;
    if (!el || n === 0) return;
    const rel = clientX - el.getBoundingClientRect().left;
    let best = 0;
    for (let i = 1; i < n; i++) if (Math.abs(x(i) - rel) < Math.abs(x(best) - rel)) best = i;
    setIdx(best);
  };

  return (
    <div>
      <div
        ref={ref}
        className="relative w-full touch-pan-y rounded-xl outline-offset-4"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setIdx(null)}
        onBlur={() => setIdx(null)}
      >
        {width > 0 && (
          <svg width={width} height={height} className="absolute inset-0 overflow-visible">
            {[0.25, 0.5, 0.75, 1].map((g) => (
              <line key={g} x1={padL} x2={width - padR} y1={y(max * g / 1.1)} y2={y(max * g / 1.1)} stroke="var(--color-line)" strokeDasharray="2 4" />
            ))}
            {series.map((s, si) => {
              const d = s.values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
              return (
                <g key={s.key}>
                  {area && si === 0 && n > 1 && (
                    <motion.path
                      d={`${d} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`}
                      fill={s.color}
                      fillOpacity={0.1}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                    />
                  )}
                  {n > 1 && (
                    <motion.path
                      d={d}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2.25}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      strokeDasharray={s.dashed ? "6 5" : undefined}
                      initial={reduce || s.dashed ? { opacity: 0 } : { pathLength: 0 }}
                      animate={reduce || s.dashed ? { opacity: 1 } : { pathLength: 1 }}
                      transition={{ duration: 0.9, ease: EASE, delay: si * 0.15 }}
                    />
                  )}
                  {s.values.map((v, i) => (
                    <circle
                      key={i}
                      cx={x(i)}
                      cy={y(v)}
                      r={idx === i ? 5 : markers?.[i] && si === 0 ? 4.5 : 3}
                      fill={markers?.[i] && si === 0 ? "var(--color-amber-bright)" : "var(--color-surface)"}
                      stroke={markers?.[i] && si === 0 ? "var(--color-amber)" : s.color}
                      strokeWidth={2}
                    />
                  ))}
                </g>
              );
            })}
            {idx !== null && <line x1={x(idx)} x2={x(idx)} y1={padT} y2={height - padB} stroke="var(--color-ink-3)" strokeWidth={1} />}
            <text x={padL} y={height - 6} fontSize={11} fill="var(--color-ink-3)">
              {labels[0]}
            </text>
            {n > 1 && (
              <text x={width - padR} y={height - 6} fontSize={11} fill="var(--color-ink-3)" textAnchor="end">
                {labels[n - 1]}
              </text>
            )}
          </svg>
        )}
        {idx !== null && width > 0 && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-40 -translate-x-1/2 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[var(--shadow-lift)]"
            style={{ left: Math.min(Math.max(x(idx), 84), width - 84) }}
          >
            <p className="font-semibold text-ink">{labels[idx]}</p>
            {series.map((s) => (
              <p key={s.key} className="mt-0.5 flex justify-between gap-4">
                <span className="text-ink-2">{s.label}</span>
                <span className="num font-semibold" style={{ color: s.color }}>
                  {format(s.values[idx])}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden>
              <line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? "4 3" : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
        <span className="text-ink-3">Focus the chart and use ← → to read values.</span>
      </div>
    </div>
  );
}

export function BarChart({
  labels,
  values,
  colors,
  height = 180,
  format,
  ariaLabel,
}: {
  labels: string[];
  values: number[];
  colors: string[];
  height?: number;
  format: (v: number, i: number) => string;
  ariaLabel: string;
}) {
  const reduce = useReduceMotion();
  const [idx, setIdx] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  return (
    <div>
      <div
        className="flex items-end gap-[3px] rounded-xl"
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setIdx((i) => Math.min(values.length - 1, (i ?? -1) + 1));
          if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, (i ?? values.length) - 1));
        }}
        onPointerLeave={() => setIdx(null)}
        onBlur={() => setIdx(null)}
      >
        {values.map((v, i) => (
          <div key={i} className="relative flex h-full flex-1 items-end" onPointerEnter={() => setIdx(i)} onPointerDown={() => setIdx(i)}>
            <motion.div
              className="w-full origin-bottom rounded-t-md"
              style={{ height: `${Math.max(v > 0 ? 3 : 1.5, (v / max) * 100)}%`, background: colors[i], opacity: idx === null || idx === i ? 1 : 0.45 }}
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.6, ease: EASE, delay: Math.min(i, 24) * 0.02 }}
            />
          </div>
        ))}
      </div>
      <p className="num mt-2 min-h-5 text-xs text-ink-2" aria-live="polite">
        {idx !== null ? `${labels[idx]} · ${format(values[idx], idx)}` : "Hover, tap or focus + ← → for details."}
      </p>
    </div>
  );
}
