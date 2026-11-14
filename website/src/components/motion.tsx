"use client";

import { animate, motion, MotionConfig, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fmtNum } from "@/lib/format";

export const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Reduced-motion preference that is safe for static pre-rendering:
 * returns false on the server AND on the first client render (so hydration
 * matches), then the real preference after mount.
 */
export function useReducedMotionSafe() {
  const pref = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && !!pref;
}

/** Global motion settings: respects the OS "reduce motion" preference. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fade + rise once when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "header";
}) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

/**
 * Counts up to `value` the first time it scrolls into view.
 * Server HTML contains the final value, so the number is correct without JS
 * and with reduced motion.
 */
export function CountUp({
  value,
  digits = 0,
  prefix = "",
  suffix = "",
  duration = 1.2,
  className,
}: {
  value: number;
  digits?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const text = (v: number) => `${prefix}${fmtNum(v, digits)}${suffix}`;

  useEffect(() => {
    if (!inView || reduce || !ref.current) return;
    const node = ref.current;
    const controls = animate(0, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        node.textContent = text(v);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduce, value]);

  return (
    <span ref={ref} className={className}>
      {text(value)}
    </span>
  );
}
