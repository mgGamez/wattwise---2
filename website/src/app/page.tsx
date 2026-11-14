"use client";

import Link from "next/link";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { Logo } from "@/components/AppShell";
import { IconArrowRight, IconBolt, IconCheck, IconInsights, IconShield } from "@/components/icons";
import { SPRING, useReduceMotion } from "@/components/motion";
import { buttonClass } from "@/components/ui";
import { enableSound, playLatch, playWhoosh } from "@/lib/sounds";

const FRAMES = ["/landing/frame-1.jpg", "/landing/frame-2.jpg", "/landing/frame-3.jpg", "/landing/frame-4.jpg"];
// "Analyze now" as drawn in frame 4 (fractions of the image), so the real button sits on top of it
const BUTTON = { x: 0.512, y: 0.484, w: 0.27, h: 0.135 };

export default function Landing() {
  const reduce = useReduceMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // scroll-scrubbed door: four photos crossfade as you scroll through the pinned section
  const o1 = useTransform(scrollYProgress, [0, 0.2, 0.28], [1, 1, 0]);
  const o2 = useTransform(scrollYProgress, [0.2, 0.28, 0.45, 0.53], [0, 1, 1, 0]);
  const o3 = useTransform(scrollYProgress, [0.45, 0.53, 0.68, 0.76], [0, 1, 1, 0]);
  const o4 = useTransform(scrollYProgress, [0.68, 0.76, 1], [0, 1, 1]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.05]);
  const hint = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const opacities = [o1, o2, o3, o4];
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useState(false);
  const last = useRef(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setOpen(v > 0.74);
    // latch as the door unlocks, whoosh as it swings (only when scrolling forward)
    if (sound && last.current < 0.22 && v >= 0.22) playLatch();
    if (sound && last.current < 0.45 && v >= 0.45) playWhoosh();
    last.current = v;
  });
  const toggleSound = () => {
    if (sound) return setSound(false);
    if (enableSound()) {
      setSound(true);
      playLatch();
    }
  };
  const showButton = reduce || open;

  return (
    <div className="bg-canvas">
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between px-5 sm:px-10">
        <Link href="/" aria-label="WATTWISE home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={sound}
            aria-label={sound ? "Turn door sounds off" : "Turn door sounds on"}
            className="tap grid size-10 cursor-pointer place-items-center rounded-full bg-surface/80 text-ink-2 backdrop-blur transition-colors hover:text-ink"
          >
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
              {sound ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="m16 9.5 5 5m0-5-5 5" />}
            </svg>
          </button>
          <Link href="/overview/" className={buttonClass("secondary", "sm")}>
            Open app
          </Link>
        </div>
      </header>

      {/* ---------------- scroll-animated fridge */}
      <section ref={ref} aria-label="Find out your electrical summary" className={reduce ? "" : "relative h-[320vh]"} style={{ background: "#d8bfae" }}>
        <div className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden px-4">
          <motion.div className="relative w-full max-w-[1100px]" style={{ aspectRatio: "902 / 502", scale: reduce ? 1 : scale }}>
            {FRAMES.map((src, i) =>
              reduce && i !== 3 ? null : (
                // eslint-disable-next-line @next/next/no-img-element
                <motion.img
                  key={src}
                  src={src}
                  alt={i === 3 ? "An open fridge with an Analyze now button inside" : ""}
                  aria-hidden={i !== 3}
                  className="absolute inset-0 size-full rounded-[2rem] object-cover"
                  style={{ opacity: reduce ? 1 : opacities[i] }}
                  draggable={false}
                  fetchPriority={i === 0 ? "high" : "auto"}
                />
              ),
            )}
            <motion.div
              className="absolute"
              style={{ left: `${(BUTTON.x - BUTTON.w / 2) * 100}%`, top: `${(BUTTON.y - BUTTON.h / 2) * 100}%`, width: `${BUTTON.w * 100}%`, height: `${BUTTON.h * 100}%` }}
              initial={false}
              animate={{ opacity: showButton ? 1 : 0, scale: showButton ? 1 : 0.9 }}
              transition={SPRING}
            >
              <Link
                href="/analyze/"
                tabIndex={showButton ? 0 : -1}
                aria-hidden={!showButton}
                className={`flex size-full items-center justify-center gap-2 rounded-full bg-ink text-[clamp(0.8rem,1.6vw,1.15rem)] font-semibold text-white shadow-[0_18px_40px_-14px_rgb(29_32_36/0.6)] transition-transform hover:scale-[1.04] active:scale-[0.97] ${
                  showButton ? "" : "pointer-events-none"
                }`}
              >
                <IconBolt size={20} /> Analyze now
              </Link>
            </motion.div>
          </motion.div>
          {!reduce && (
            <motion.p style={{ opacity: hint }} className="absolute bottom-8 flex flex-col items-center gap-2 text-sm font-semibold text-ink-2">
              Scroll to open
              <motion.span animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} aria-hidden>
                ↓
              </motion.span>
            </motion.p>
          )}
        </div>
      </section>

      {/* ---------------- how it works */}
      <section className="mx-auto max-w-5xl px-5 py-24 sm:px-8" aria-labelledby="how-title">
        <p className="label-caps">How WATTWISE works</p>
        <h2 id="how-title" className="mt-2 max-w-2xl text-[2rem] font-bold leading-tight text-ink sm:text-[2.6rem]">
          Your bill, explained in under a minute.
        </h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            { Icon: IconInsights, title: "Enter your bills", body: "The kWh (units) from this month’s bill, plus at least three earlier months." },
            { Icon: IconBolt, title: "WATTWISE learns your normal", body: "A model fitted to your own history predicts what this month should have used." },
            { Icon: IconCheck, title: "See excess, cost and checks", body: "How much looks unusually high, what it may cost, why, and what to check first." },
          ].map(({ Icon, title, body }, i) => (
            <motion.li
              key={title}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ ...SPRING, delay: i * 0.08 }}
              className="surface p-6"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-sage-soft text-sage-strong">
                <Icon size={22} />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{body}</p>
            </motion.li>
          ))}
        </ol>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href="/analyze/" className={buttonClass("primary", "lg")}>
            Analyze my bill <IconArrowRight size={18} />
          </Link>
          <Link href="/analyze/?demo=1" className={buttonClass("secondary", "lg")}>
            Try with example bills
          </Link>
        </div>
        <p className="mt-8 flex max-w-xl items-start gap-2 text-sm leading-relaxed text-ink-3">
          <IconShield size={18} className="mt-0.5 shrink-0 text-sage" />
          Your bills stay in this browser. Nothing is sent to a server or an AI API.
        </p>
      </section>
    </div>
  );
}
