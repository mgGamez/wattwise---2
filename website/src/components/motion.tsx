"use client";

import { animate, MotionConfig, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAppState } from "@/lib/storage";

export const EASE = [0.22, 1, 0.36, 1] as const;
export const SPRING = { type: "spring", stiffness: 260, damping: 30, mass: 0.9 } as const;

/**
 * True when motion should be reduced: the OS setting OR the in-app preference.
 * Always false on the server and first client render, so hydration matches.
 */
export function useReduceMotion() {
  const os = useReducedMotion();
  const s = useAppState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && (!!os || s?.preferences.motion === "reduced");
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const s = useAppState();
  const reduced = s?.preferences.motion === "reduced";
  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduced ? "true" : "false";
  }, [reduced]);
  return <MotionConfig reducedMotion={s?.preferences.motion === "reduced" ? "always" : "user"}>{children}</MotionConfig>;
}

/**
 * Number that animates to its new value (on mount and whenever it changes).
 * The rendered text is always the correct final value; motion only affects the path there.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  delay = 0,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReduceMotion();
  const from = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView) return;
    if (reduce) {
      node.textContent = format(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration: 0.9,
      delay,
      ease: EASE,
      onUpdate: (v) => {
        node.textContent = format(v);
      },
      onComplete: () => {
        from.current = value;
      },
    });
    return () => {
      controls.stop();
      from.current = value;
      node.textContent = format(value);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
