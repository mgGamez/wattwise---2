"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { EASE, useReducedMotionSafe } from "./motion";
import { fmtNum, fmtShortDate } from "@/lib/format";

type Props = {
  line: { values: number[]; focusIndex: number; start: string; end: string } | null;
  focusActual: number | null;
};

export function Hero({ line, focusActual }: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const parallax = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 80]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, reduce ? 1 : 0.25]);

  return (
    <section
      id="top"
      ref={ref}
      aria-labelledby="hero-title"
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pt-14"
    >
      {/* restrained ambient light */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgb(122 167 255 / 0.10), transparent 70%), radial-gradient(40% 40% at 85% 75%, rgb(255 181 71 / 0.06), transparent 70%)",
        }}
      />

      <div className="container-page relative z-10">
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          AI energy intelligence for buildings
        </motion.p>

        <h1 id="hero-title" className="mt-6 text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">
          {["Your building is talking.", "WATTWISE listens."].map((lineText, i) => (
            <span key={lineText} className="block overflow-hidden pb-[0.08em]">
              <motion.span
                className={`block ${i === 1 ? "text-ink-2" : "text-ink"}`}
                initial={{ y: "105%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.1 + i * 0.12 }}
              >
                {lineText}
              </motion.span>
            </span>
          ))}
        </h1>

        <motion.p
          className="mt-7 max-w-xl text-lg leading-relaxed text-ink-2 sm:text-xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.4 }}
        >
          AI that learns normal electricity patterns and finds what doesn&rsquo;t belong.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.55 }}
        >
          <a
            href="#anomaly"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[0.95rem] font-medium text-bg transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Explore the AI
            <svg aria-hidden viewBox="0 0 16 16" className="size-4 transition-transform duration-200 group-hover:translate-y-0.5">
              <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <a href="#evidence" className="text-[0.95rem] text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline">
            See the evaluation
          </a>
        </motion.div>
      </div>

      {line && line.values.length > 1 && (
        <motion.div aria-hidden style={{ y: parallax, opacity: fade }} className="pointer-events-none relative z-0 mt-14 sm:mt-6">
          <EnergyLine
            values={line.values}
            focusIndex={line.focusIndex}
            focusActual={focusActual}
            caption={`Real measurements: 72 hours of appliance energy, ${fmtShortDate(line.start)} – ${fmtShortDate(line.end)} 2016.`}
            reduce={!!reduce}
          />
        </motion.div>
      )}
    </section>
  );
}

function EnergyLine({
  values,
  focusIndex,
  focusActual,
  caption,
  reduce,
}: {
  values: number[];
  focusIndex: number;
  focusActual: number | null;
  caption: string;
  reduce: boolean;
}) {
  const W = 1440;
  const H = 260;
  const max = Math.max(...values) * 1.08;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 8 - (v / max) * (H - 16);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const hasFocus = focusIndex >= 0 && focusIndex < values.length;
  const fx = hasFocus ? (x(focusIndex) / W) * 100 : 0;
  const fy = hasFocus ? (y(values[focusIndex]) / H) * 100 : 0;
  const drawDuration = 2.4;

  return (
    <div className="relative">
      <div className="relative h-[180px] w-full sm:h-[260px]">
        {/* Left-to-right reveal at a constant rate, so the anomaly marker appears as the line reaches it. */}
        <motion.div
          key={reduce ? "static" : "draw"}
          className="absolute inset-0"
          initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: drawDuration, ease: "linear", delay: 0.3 }}
        >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full">
          <defs>
            <linearGradient id="hero-stroke" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor="#7aa7ff" stopOpacity="0" />
              <stop offset="0.25" stopColor="#7aa7ff" stopOpacity="0.55" />
              <stop offset="0.75" stopColor="#e9ebee" stopOpacity="0.6" />
              <stop offset="1" stopColor="#e9ebee" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="hero-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#7aa7ff" stopOpacity="0.10" />
              <stop offset="1" stopColor="#7aa7ff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${d} L${W},${H} L0,${H} Z`} fill="url(#hero-fill)" />
          <path
            d={d}
            fill="none"
            stroke="url(#hero-stroke)"
            strokeWidth={1.4}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        </motion.div>
        {hasFocus && (
          <motion.div
            className="absolute"
            style={{ left: `${fx}%`, top: `${fy}%` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 0.3 + drawDuration * (focusIndex / values.length) + 0.2, duration: 0.4 }}
          >
            {!reduce && (
              <motion.span
                className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-unexpected"
                initial={{ scale: 0.6, opacity: 0.8 }}
                animate={{ scale: 2.6, opacity: 0 }}
                transition={{ duration: 1.8, repeat: 3, ease: "easeOut", delay: 0.2 }}
              />
            )}
            <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-unexpected shadow-[0_0_16px_rgb(255_181_71/0.6)]" />
            {focusActual !== null && (
              <span className="num absolute left-3 -top-7 whitespace-nowrap rounded-full border border-unexpected/30 bg-bg/80 px-2 py-0.5 text-[11px] text-unexpected backdrop-blur">
                Unexpected · {fmtNum(focusActual)} Wh
              </span>
            )}
          </motion.div>
        )}
      </div>
      <p className="container-page mt-3 text-xs text-ink-3">{caption}</p>
    </div>
  );
}
