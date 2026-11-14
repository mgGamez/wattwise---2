"use client";

// WATTWISE landing: a scroll-driven product story. The fridge is the metaphor —
// closed = you only know the bill; open = WATTWISE shows what's underneath;
// the button inside = enter the real product. Every number on this page is real:
// research outputs from results/ (via site-data.json) and the example bills,
// analysed live in this browser by the same code the app uses.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/AppShell";
import { AnimatedNumber, EASE, SPRING, useReduceMotion } from "@/components/motion";
import { CATEGORY_ICON, IconArrowRight, IconBolt, IconCheck, IconClock, IconFlask, IconHistory, IconInsights, IconShield } from "@/components/icons";
import { buttonClass, StatusPill } from "@/components/ui";
import { site } from "@/lib/data";
import { analyseBill, type Bill } from "@/lib/ml/bills";
import demoBillsJson from "@/data/demo-bills.json";
import { monthName } from "@/lib/explain";
import { fmtNum, ordinal } from "@/lib/money";
import { enableSound, playLatch, playWhoosh } from "@/lib/sounds";

const FRAMES = ["/landing/frame-1.jpg", "/landing/frame-2.jpg", "/landing/frame-3.jpg", "/landing/frame-4.jpg"];
// "Analyze now" as drawn in frame 4 (fractions of the image), so the real button sits on top of it
const BUTTON = { x: 0.512, y: 0.484, w: 0.27, h: 0.135 };
const EXAMPLE_TARIFF = 8.5; // ₹/kWh, clearly labelled as an example wherever shown

/* ================================================================== page */
export default function Landing() {
  const reduce = useReduceMotion();
  const [sound, setSound] = useState(false);
  const toggleSound = () => {
    if (sound) return setSound(false);
    if (enableSound()) {
      setSound(true);
      playLatch();
    }
  };

  return (
    <div className="overflow-x-clip bg-canvas">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between px-5 sm:px-10">
        <div>
          <Link href="/" aria-label="WATTWISE home">
            <Logo />
          </Link>
          <p className="mt-1 hidden text-xs font-medium text-ink-3 sm:block">Your energy tells a story.</p>
        </div>
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

      <FridgeScene reduce={reduce} sound={sound} />
      <WasItNormal reduce={reduce} />
      <PipelineStory reduce={reduce} />
      <MoneyStory reduce={reduce} />
      <LoopStory reduce={reduce} />
      <ProductPreview reduce={reduce} />
      <TechSection reduce={reduce} />
      <FailureLab reduce={reduce} />
      <ClosingScene reduce={reduce} />

      <footer className="border-t border-line px-5 py-10 text-sm text-ink-3 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Research data: UCI Appliances Energy Prediction (CC BY 4.0). Everything runs in your browser — no energy data is sent to a
            generative AI API.
          </p>
          <a href="https://github.com/mgGamez/wattwise---2" rel="noopener noreferrer" className="shrink-0 font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline">
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

/* ================================================================== scene 1: the fridge */
function FridgeScene({ reduce, sound }: { reduce: boolean; sound: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  // spring-smoothed scrub: the door follows the scroll, never a timed animation
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.0005 });

  // frame crossfades (real renders of the same fridge: closed → latch → swinging → open)
  const o1 = useTransform(p, [0, 0.26, 0.34], [1, 1, 0]);
  const o2 = useTransform(p, [0.26, 0.34, 0.46, 0.52], [0, 1, 1, 0]);
  const o3 = useTransform(p, [0.46, 0.52, 0.6, 0.66], [0, 1, 1, 0]);
  const o4 = useTransform(p, [0.6, 0.66, 1], [0, 1, 1]);
  const opacities = [o1, o2, o3, o4];

  // camera: slow push-in toward the fridge; background parallax moves slower
  const scale = useTransform(p, [0, 0.9], [0.95, 1.12]);
  const camY = useTransform(p, [0, 1], ["0%", "-2%"]);
  const bgY = useTransform(p, [0, 1], [0, -60]);
  // the handle reacts just before the latch releases
  const jiggle = useTransform(p, [0.2, 0.24, 0.28], [0, 0.5, 0]);
  // warm interior light builds as the door opens
  const glow = useTransform(p, [0.45, 0.85], [0, 0.55]);
  // copy sequencing
  const introFade = useTransform(p, [0, 0.12], [1, 0]);
  const copyA = useTransform(p, [0.13, 0.2, 0.3, 0.37], [0, 1, 1, 0]);
  const keepHint = useTransform(p, [0.34, 0.4, 0.5, 0.56], [0, 1, 1, 0]);
  const copyB = useTransform(p, [0.76, 0.84], [0, 1]);
  // the signature hand-off: a canvas-coloured circle grows out of the interior
  const expandScale = useTransform(p, [0.88, 1], [0, 26]);
  const expandOpacity = useTransform(p, [0.88, 0.92], [0, 1]);

  const [open, setOpen] = useState(false);
  const last = useRef(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setOpen(v > 0.7);
    if (sound && last.current < 0.24 && v >= 0.24) playLatch();
    if (sound && last.current < 0.48 && v >= 0.48) playWhoosh();
    last.current = v;
  });
  const showButton = reduce || open;

  // click-to-enter: the interior light expands over the page, then the real Analyze opens
  const [leaving, setLeaving] = useState(false);
  const enter = (e: React.MouseEvent) => {
    e.preventDefault();
    if (reduce || leaving) {
      router.push("/analyze/");
      return;
    }
    setLeaving(true);
    setTimeout(() => router.push("/analyze/"), 480);
  };

  return (
    <section
      ref={ref}
      aria-label="Find out your electrical summary — scroll to open the fridge"
      className={reduce ? "" : "relative h-[420vh]"}
      style={{ background: "#d8bfae" }}
    >
      <div className="sticky top-0 flex h-dvh flex-col items-center justify-center overflow-hidden px-4">
        {/* background moves slower than the fridge (parallax) */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-[-10%]"
            style={{ y: bgY, background: "radial-gradient(60% 55% at 50% 42%, rgb(255 246 232 / 0.55), transparent 70%)" }}
          />
        )}

        {reduce && (
          <h1 className="relative z-10 mb-6 mt-20 text-center text-3xl font-bold text-ink">Find out your electrical summary</h1>
        )}

        <motion.div
          className="relative w-[175vw] shrink-0 will-change-transform sm:w-full sm:max-w-[1040px]"
          style={reduce ? { aspectRatio: "902 / 502" } : { aspectRatio: "902 / 502", scale, y: camY, rotate: jiggle }}
        >
          {/* soft contact shadow under the “physical” fridge */}
          <div aria-hidden className="absolute inset-x-[18%] bottom-[2%] h-[6%] rounded-[50%] bg-[#9c7f6a]/40 blur-xl" />
          {FRAMES.map((src, i) =>
            reduce && i !== 3 ? null : (
              // eslint-disable-next-line @next/next/no-img-element
              <motion.img
                key={src}
                src={src}
                alt={i === 3 ? "An open fridge: inside is an Analyze now button instead of food" : ""}
                aria-hidden={i !== 3}
                className="absolute inset-0 size-full rounded-[2rem] object-cover"
                style={{ opacity: reduce ? 1 : opacities[i] }}
                draggable={false}
                loading="eager"
                fetchPriority={i < 2 ? "high" : "auto"}
              />
            ),
          )}
          {/* interior light spilling out as the door opens */}
          {!reduce && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[2rem]"
              style={{ opacity: glow, background: "radial-gradient(42% 55% at 56% 45%, rgb(255 214 150 / 0.8), transparent 72%)", mixBlendMode: "soft-light" }}
            />
          )}

          {/* the REAL button, physically placed inside the fridge */}
          <motion.div
            className="absolute"
            style={{ left: `${(BUTTON.x - BUTTON.w / 2) * 100}%`, top: `${(BUTTON.y - BUTTON.h / 2) * 100}%`, width: `${BUTTON.w * 100}%`, height: `${BUTTON.h * 100}%` }}
            initial={false}
            animate={{ opacity: showButton ? 1 : 0, scale: showButton ? 1 : 0.9 }}
            transition={SPRING}
          >
            <Link
              href="/analyze/"
              onClick={enter}
              tabIndex={showButton ? 0 : -1}
              aria-hidden={!showButton}
              className={`flex size-full items-center justify-center gap-2 whitespace-nowrap rounded-full bg-ink text-[clamp(0.85rem,2.6vw,1.15rem)] font-semibold text-white shadow-[0_18px_40px_-14px_rgb(29_32_36/0.6)] transition-transform hover:scale-[1.04] active:scale-[0.97] ${
                showButton ? "" : "pointer-events-none"
              }`}
            >
              <IconBolt size={20} /> Analyze now
            </Link>
          </motion.div>
        </motion.div>

        {/* copy choreography (never on top of the fridge) */}
        {!reduce && (
          <>
            <motion.p style={{ opacity: introFade }} className="pointer-events-none absolute bottom-8 flex flex-col items-center gap-2 text-sm font-semibold text-ink-2">
              Scroll to discover
              <motion.span animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} aria-hidden>
                ↓
              </motion.span>
            </motion.p>
            <motion.div style={{ opacity: copyA }} aria-hidden className="pointer-events-none absolute bottom-[7%] max-w-md px-6 text-center">
              <p className="text-lg font-bold text-ink sm:text-xl">Your electricity bill shows the total.</p>
              <p className="mt-1 text-lg font-bold text-sage-strong sm:text-xl">WATTWISE looks underneath it.</p>
            </motion.div>
            <motion.p style={{ opacity: keepHint }} aria-hidden className="pointer-events-none absolute bottom-[8%] text-sm font-semibold text-ink-2">
              Keep scrolling
            </motion.p>
            <motion.p style={{ opacity: copyB }} aria-hidden className="pointer-events-none absolute bottom-[7%] max-w-md px-6 text-center text-lg font-bold text-ink sm:text-xl">
              See what your electricity use is really telling you.
            </motion.p>
            {/* hand-off: interior “light” expands to become the page behind the next scene */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 size-[18vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-canvas"
              style={{ scale: expandScale, opacity: expandOpacity }}
            />
          </>
        )}
      </div>

      {/* click transition into the real product */}
      <AnimatePresence>
        {leaving && (
          <motion.div
            className="fixed inset-0 z-50 bg-canvas"
            initial={{ clipPath: `circle(0% at 51% 48%)` }}
            animate={{ clipPath: `circle(150% at 51% 48%)` }}
            transition={{ duration: 0.5, ease: EASE }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/* ================================================================== scene 2: was it normal? */
function WasItNormal({ reduce }: { reduce: boolean }) {
  const reading = site.context?.lowButUnusual ?? null; // real held-out reading: 320 Wh actual vs 77.66 expected
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });
  const q1o = useTransform(p, [0, 0.2, 0.32], [1, 1, 0]);
  const q1y = useTransform(p, [0, 0.32], [0, -60]);
  const q2o = useTransform(p, [0.26, 0.38], [0, 1]);
  const q2s = useTransform(p, [0.26, 0.42], [0.92, 1]);
  const q2y = useTransform(p, [0.5, 0.64], [0, -40]);
  const [showNums, setShowNums] = useState(false);
  useMotionValueEvent(scrollYProgress, "change", (v) => setShowNums(v > 0.5));
  if (!reading) return null;

  const numbers = (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
      {[
        { label: "ACTUAL", v: reading.actual, cls: "text-ink", sub: "what the meter recorded" },
        { label: "EXPECTED", v: reading.expected, cls: "text-blue", sub: "what the AI predicted" },
        { label: "POTENTIAL EXCESS", v: reading.residual, cls: "text-amber", sub: "worth a closer look", plus: true },
      ].map((s, i) => (
        <motion.div
          key={s.label}
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ ...SPRING, delay: i * 0.1 }}
          className="surface px-6 py-5 text-center"
        >
          <p className="label-caps">{s.label}</p>
          <p className={`num mt-1 text-4xl font-bold sm:text-5xl ${s.cls}`}>
            {s.plus ? "+" : ""}
            <AnimatedNumber value={s.v} format={(v) => fmtNum(v)} delay={i * 0.1} />
            <span className="ml-1 text-lg text-ink-3">Wh</span>
          </p>
          <p className="mt-1 text-xs text-ink-3">{s.sub}</p>
        </motion.div>
      ))}
    </div>
  );

  if (reduce)
    return (
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-5 py-24 text-center">
        <h2 className="text-4xl font-bold text-ink">
          You know how much electricity you used. <span className="text-sage-strong">But was it normal?</span>
        </h2>
        {numbers}
        <p className="text-xs text-ink-3">One real reading from the held-out research data — never seen by the model in training.</p>
      </section>
    );

  return (
    <section ref={ref} aria-label="You know how much electricity you used. But was it normal?" className="relative h-[260vh] bg-canvas">
      <div className="sticky top-0 flex h-dvh flex-col items-center justify-center gap-8 overflow-hidden px-5 text-center">
        <motion.h2 style={{ opacity: q1o, y: q1y }} className="absolute px-6 text-[clamp(2rem,6vw,4.5rem)] font-bold leading-tight text-ink">
          You know how much
          <br />
          electricity you used.
        </motion.h2>
        <motion.h2 style={{ opacity: q2o, scale: q2s, y: q2y }} className="px-6 text-[clamp(2.2rem,7vw,5.5rem)] font-bold leading-tight text-sage-strong">
          But was it normal?
        </motion.h2>
        {showNums && (
          <>
            {numbers}
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-xs text-ink-3">
              One real reading from the held-out research data — never seen by the model in training.
            </motion.p>
          </>
        )}
      </div>
    </section>
  );
}

/* ================================================================== shared bits */
function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="label-caps">{children}</p>;
}

function Big({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-3 max-w-3xl text-[clamp(1.9rem,4.5vw,3.4rem)] font-bold leading-[1.08] text-ink">
      {children}
    </h2>
  );
}

const inView = (reduce: boolean, delay = 0) =>
  reduce
    ? {}
    : { initial: { opacity: 0, y: 22 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.35 }, transition: { ...SPRING, delay } };

function FlowArrow() {
  return (
    <svg aria-hidden width="12" height="30" viewBox="0 0 12 30" className="mx-auto">
      <path d="M6 1 V29" stroke="var(--color-line-strong)" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 1 V29" stroke="var(--color-sage-bright)" strokeWidth="2" strokeDasharray="3 7" className="flow-dash" />
    </svg>
  );
}

/* ================================================================== scene 3: pipeline */
function PipelineStory({ reduce }: { reduce: boolean }) {
  const inputs = [
    { Icon: IconHistory, label: "Historical energy" },
    { Icon: IconClock, label: "Time patterns" },
    { Icon: IconInsights, label: "Recent usage" },
  ];
  const chain = [
    { label: "WATTWISE AI", sub: site.model ? `${site.model.selected.name}, trained on real readings` : "trained model", tone: "bg-ink text-white" },
    { label: "Expected consumption", sub: "what normal looks like right now", tone: "bg-blue-soft text-blue" },
    { label: "Actual vs expected", sub: "the gap is the story", tone: "bg-surface text-ink border border-line" },
    { label: "Unexpected usage detected", sub: "worth checking — never “cause found”", tone: "bg-amber-soft text-amber" },
  ];
  return (
    <section className="mx-auto max-w-4xl px-5 py-24 sm:py-32" aria-labelledby="pipe-title">
      <Eyebrow>How it works</Eyebrow>
      <Big id="pipe-title">It learns normal. Then it measures surprise.</Big>
      <div className="mt-12">
        <div className="grid gap-3 sm:grid-cols-3">
          {inputs.map(({ Icon, label }, i) => (
            <motion.div key={label} {...inView(reduce, i * 0.08)} className="flex items-center justify-center gap-2.5 rounded-2xl bg-sunken px-4 py-3.5 font-semibold text-ink">
              <Icon size={20} className="text-sage-strong" /> {label}
            </motion.div>
          ))}
        </div>
        <FlowArrow />
        <ol className="mx-auto max-w-xl">
          {chain.map((c, i) => (
            <li key={c.label}>
              {i > 0 && <FlowArrow />}
              <motion.div {...inView(reduce, 0.05 * i)} className={`rounded-2xl px-6 py-4 text-center ${c.tone}`}>
                <p className="text-lg font-bold">{c.label}</p>
                <p className="text-sm opacity-85">{c.sub}</p>
              </motion.div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ================================================================== scene 4: money */
function MoneyStory({ reduce }: { reduce: boolean }) {
  const reading = site.context?.lowButUnusual;
  if (!reading) return null;
  const wh = reading.residual;
  const kwh = wh / 1000;
  const cost = kwh * EXAMPLE_TARIFF;
  const steps = [
    { big: `${fmtNum(wh)} Wh`, v: wh, f: (v: number) => `${fmtNum(v)} Wh`, small: "unexpected energy" },
    { big: `${kwh.toFixed(2)} kWh`, v: kwh, f: (v: number) => `${v.toFixed(2)} kWh`, small: "÷ 1,000 — the unit on your bill" },
    { big: `₹${EXAMPLE_TARIFF.toFixed(2)} / kWh`, v: EXAMPLE_TARIFF, f: (v: number) => `₹${v.toFixed(2)} / kWh`, small: "× your tariff (example shown)" },
    { big: `₹${cost.toFixed(2)}`, v: cost, f: (v: number) => `₹${v.toFixed(2)}`, small: "estimated potential excess cost" },
  ];
  return (
    <section className="bg-sunken/60 px-5 py-24 sm:py-32" aria-labelledby="money-title">
      <div className="mx-auto max-w-4xl">
        <Eyebrow>Why it matters</Eyebrow>
        <Big id="money-title">
          Energy numbers are hard to feel. <span className="text-sage-strong">Money isn’t.</span>
        </Big>
        <ol className="mx-auto mt-12 max-w-md">
          {steps.map((s, i) => (
            <li key={s.small}>
              {i > 0 && <FlowArrow />}
              <motion.div {...inView(reduce, 0.06 * i)} className={`rounded-3xl px-8 py-6 text-center ${i === steps.length - 1 ? "bg-ink text-white shadow-[var(--shadow-lift)]" : "surface"}`}>
                <p className="num text-[clamp(1.8rem,5vw,2.6rem)] font-bold">
                  <AnimatedNumber value={s.v} format={s.f} />
                </p>
                <p className={`mt-1 text-sm font-medium ${i === steps.length - 1 ? "text-white/75" : "text-ink-2"}`}>{s.small}</p>
              </motion.div>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-8 max-w-md text-center text-sm leading-relaxed text-ink-2">
          Real numbers from the same held-out reading above, at an example tariff of ₹{EXAMPLE_TARIFF.toFixed(2)}/kWh. In the app, WATTWISE
          uses <strong className="text-ink">your</strong> tariff.
        </p>
      </div>
    </section>
  );
}

/* ================================================================== scene 5: the loop */
function LoopStory({ reduce }: { reduce: boolean }) {
  const steps = ["WATTWISE detects", "You investigate", "You change the pattern", "You measure again", "You reduce unnecessary use"];
  const areas = [
    { key: "cooling-heating", label: "Cooling / heating" },
    { key: "lighting", label: "Lighting" },
    { key: "standby", label: "Standby devices" },
    { key: "timing", label: "Equipment schedules" },
    { key: "high-load", label: "High-load devices" },
  ] as const;
  return (
    <section className="mx-auto max-w-5xl px-5 py-24 sm:py-32" aria-labelledby="loop-title">
      <Eyebrow>From insight to action</Eyebrow>
      <Big id="loop-title">A loop, not a report.</Big>
      <ol className="mt-12 grid gap-3 md:grid-cols-5">
        {steps.map((s, i) => (
          <motion.li key={s} {...inView(reduce, i * 0.08)} className="relative rounded-2xl bg-sunken p-5">
            <span className="grid size-8 place-items-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
            <p className="mt-3 font-bold leading-snug text-ink">{s}</p>
            {i < steps.length - 1 && (
              <svg aria-hidden className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 md:block" width="18" height="12" viewBox="0 0 18 12">
                <path d="M1 6 H15 M11 2 L15 6 L11 10" fill="none" stroke="var(--color-sage)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </motion.li>
        ))}
      </ol>
      <ul className="mt-8 flex flex-wrap gap-3">
        {areas.map(({ key, label }, i) => {
          const Icon = CATEGORY_ICON[key];
          return (
            <motion.li key={key} {...inView(reduce, 0.3 + i * 0.05)} className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-2 pl-2 pr-4 text-sm font-semibold text-ink">
              <span className="grid size-8 place-items-center rounded-full bg-sage-soft text-sage-strong">
                <Icon size={18} />
              </span>
              {label}
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-ink-3">WATTWISE can’t see individual appliances — these are areas worth checking, never “cause found”.</p>
    </section>
  );
}

/* ================================================================== scene 6: live product preview */
function ProductPreview({ reduce }: { reduce: boolean }) {
  const bills = demoBillsJson as Bill[];
  const r = useMemo(() => analyseBill(bills.slice(0, -1), bills[bills.length - 1]), [bills]);
  const current = bills[bills.length - 1];
  const max = Math.max(current.kwh, r.expectedKwh);
  return (
    <section className="bg-sunken/60 px-5 py-24 sm:py-32" aria-labelledby="preview-title">
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-[1fr_minmax(0,24rem)]">
        <div>
          <Eyebrow>The real product</Eyebrow>
          <Big id="preview-title">This preview just ran the real model.</Big>
          <p className="mt-4 max-w-md leading-relaxed text-ink-2">
            The card beside this text was computed in your browser a moment ago — the real example bills from the research dataset, through
            the exact code the app runs. No mock-ups, no screenshots.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/analyze/?demo=1" className={buttonClass("primary")}>
              Run it yourself <IconArrowRight size={18} />
            </Link>
          </div>
        </div>
        <motion.div {...inView(reduce)} className="mx-auto w-full max-w-sm rounded-[2.2rem] border border-line bg-surface p-5 shadow-[var(--shadow-lift)]">
          <div className="flex items-center justify-between">
            <p className="font-bold text-ink">{monthName(current.month)}</p>
            <StatusPill status={r.flagged ? "unusual" : r.low ? "below" : "normal"} size="sm" />
          </div>
          <div className="mt-5 space-y-4">
            {[
              { label: "Actual", v: current.kwh, cls: "bg-ink", txt: "text-ink" },
              { label: "AI expected", v: r.expectedKwh, cls: "bg-blue-bright", txt: "text-blue" },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-ink-2">{row.label}</span>
                  <span className={`num font-bold ${row.txt}`}>{fmtNum(row.v, 1)} kWh</span>
                </div>
                <div className="mt-1.5 h-3 rounded-full bg-sunken">
                  <motion.div
                    className={`h-full rounded-full ${row.cls}`}
                    initial={reduce ? false : { width: 0 }}
                    whileInView={{ width: `${(row.v / max) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: EASE }}
                  />
                </div>
              </div>
            ))}
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-2 text-sm">
            {[
              { k: "Difference", v: `${r.residualKwh >= 0 ? "+" : "−"}${fmtNum(Math.abs(r.residualKwh), 1)} kWh` },
              { k: "Potential excess", v: `${fmtNum(r.potentialExcessKwh, 1)} kWh` },
              { k: "Percentile", v: ordinal(Math.min(r.percentile, 99)) },
              { k: "Usual variation", v: `±${fmtNum(r.fit.sigma, 1)} kWh/day` },
            ].map((s) => (
              <div key={s.k} className="rounded-xl bg-sunken px-3 py-2.5">
                <dt className="text-xs text-ink-3">{s.k}</dt>
                <dd className="num font-bold text-ink">{s.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            {r.flagged ? "Unusually high — checks suggested." : "Within normal variation — nothing to investigate. Checks appear when a bill is unusually high."}
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ================================================================== scene 7: technical */
function TechSection({ reduce }: { reduce: boolean }) {
  const m = site.model;
  if (!m) return null;
  const bars = [
    { label: "Baseline MAE", v: m.finalTest.baseline.mae, cls: "bg-ink-3/60" },
    { label: "WATTWISE MAE", v: m.finalTest.model.mae, cls: "bg-sage" },
    { label: "Baseline RMSE", v: m.finalTest.baseline.rmse, cls: "bg-ink-3/60" },
    { label: "WATTWISE RMSE", v: m.finalTest.model.rmse, cls: "bg-sage" },
  ];
  const maxBar = Math.max(...bars.map((b) => b.v));
  return (
    <section className="mx-auto max-w-5xl px-5 py-24 sm:py-32" aria-labelledby="tech-title">
      <Eyebrow>The research underneath</Eyebrow>
      <Big id="tech-title">Not another AI wrapper.</Big>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <motion.div {...inView(reduce)} className="surface p-6">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-ink-3">Dataset</dt>
              <dd className="mt-0.5 font-bold text-ink">{m.dataset.name}</dd>
              <dd className="text-ink-2">
                {fmtNum(m.dataset.rows)} readings · {m.dataset.units} · {m.dataset.license}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-3">Selected model</dt>
              <dd className="mt-0.5 font-bold text-ink">{m.selected.name}</dd>
              <dd className="text-ink-2">{m.selected.rule}</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink-3">Anomaly methodology</dt>
              <dd className="mt-0.5 text-ink-2">
                residual = actual − predicted; flagged at the {m.anomalyMethod.rule.toLowerCase()} ({fmtNum(m.anomalyMethod.thresholdWh)} Wh).
              </dd>
            </div>
          </dl>
        </motion.div>
        <motion.div {...inView(reduce, 0.08)} className="surface p-6">
          <p className="text-sm font-semibold text-ink-3">Final test, unseen data (Wh per 10 min — lower is better)</p>
          <ul className="mt-4 space-y-3">
            {bars.map((b) => (
              <li key={b.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-ink-2">{b.label}</span>
                  <span className="num font-bold text-ink">{fmtNum(b.v, 2)}</span>
                </div>
                <div className="mt-1 h-2.5 rounded-full bg-sunken">
                  <motion.div
                    className={`h-full rounded-full ${b.cls}`}
                    initial={reduce ? false : { width: 0 }}
                    whileInView={{ width: `${(b.v / maxBar) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.7, ease: EASE }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="num mt-5 text-3xl font-bold text-sage-strong">
            −{m.finalTest.improvement.mae}% <span className="text-base font-semibold text-ink-2">average error vs baseline</span>
          </p>
          <p className="num text-sm font-semibold text-ink-2">−{m.finalTest.improvement.rmse}% on large misses (RMSE)</p>
        </motion.div>
      </div>
      <motion.p {...inView(reduce, 0.12)} className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-2xl bg-sage-soft px-5 py-3.5 text-sm font-semibold text-sage-strong">
        <IconShield size={18} /> Runs locally. No generative AI API required.
        {m.leakageCheckPassed && (
          <span className="inline-flex items-center gap-1 text-ink-2">
            <IconCheck size={15} /> automatic leakage check passed
          </span>
        )}
      </motion.p>
    </section>
  );
}

/* ================================================================== scene 8: failures */
function FailureLab({ reduce }: { reduce: boolean }) {
  const failures = site.failures?.slice(0, 3) ?? [];
  if (!failures.length) return null;
  return (
    <section className="bg-sunken/60 px-5 py-24 sm:py-32" aria-labelledby="fail-title">
      <div className="mx-auto max-w-5xl">
        <Eyebrow>Honesty</Eyebrow>
        <Big id="fail-title">AI gets things wrong.</Big>
        <p className="mt-4 max-w-xl leading-relaxed text-ink-2">
          Three of the research model’s largest misses on held-out data. Flip each card between what the AI expected and what actually
          happened.
        </p>
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {failures.map((f, i) => (
            <FailureCard key={f.t} f={f} reduce={reduce} delay={i * 0.08} />
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-ink-3">
          The model can’t see occupancy, specific appliances or one-off events — sudden switch-ons are unpredictable from the past alone. We
          show these because trust needs the failures too.
        </p>
      </div>
    </section>
  );
}

function FailureCard({ f, reduce, delay }: { f: NonNullable<(typeof site)["failures"]>[number]; reduce: boolean; delay: number }) {
  const [showActual, setShowActual] = useState(false);
  const max = Math.max(f.actual, f.expected);
  const v = showActual ? f.actual : f.expected;
  return (
    <motion.li {...inView(reduce, delay)} className="surface p-5">
      <p className="num text-xs font-semibold text-ink-3">{f.t.slice(0, 16)}</p>
      <div className="mt-4 flex h-28 items-end">
        <motion.div
          className={`w-full rounded-t-xl ${showActual ? "bg-ink" : "bg-blue-bright"}`}
          animate={{ height: `${(v / max) * 100}%` }}
          transition={SPRING}
        />
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={showActual ? "a" : "e"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className={`num mt-3 text-3xl font-bold ${showActual ? "text-ink" : "text-blue"}`}
        >
          {fmtNum(v)} Wh
        </motion.p>
      </AnimatePresence>
      <div role="group" aria-label="Flip between AI expected and actual" className="mt-4 flex rounded-full bg-sunken p-1">
        {[
          { label: "AI EXPECTED", val: false },
          { label: "ACTUAL", val: true },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={showActual === o.val}
            onClick={() => setShowActual(o.val)}
            className={`tap h-9 flex-1 cursor-pointer rounded-full text-xs font-bold transition-colors ${
              showActual === o.val ? "bg-surface text-ink shadow-[0_1px_3px_rgb(29_32_36/0.12)]" : "text-ink-3 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-2">
        Off by <span className="num font-bold text-ink">{fmtNum(f.absError)} Wh</span> —{" "}
        {f.error > 0 ? "a sudden jump it couldn’t foresee." : "it expected high use to continue."}
      </p>
    </motion.li>
  );
}

/* ================================================================== scene 9: closing */
function ClosingScene({ reduce }: { reduce: boolean }) {
  return (
    <section
      aria-labelledby="closing-title"
      className="relative overflow-hidden px-5 py-28 text-center sm:py-36"
      style={{ background: "radial-gradient(60% 70% at 50% 100%, rgb(255 224 170 / 0.5), var(--color-canvas) 70%)" }}
    >
      <motion.div {...inView(reduce)} className="mx-auto w-44 overflow-hidden rounded-3xl shadow-[var(--shadow-lift)] sm:w-56">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/frame-4.jpg" alt="" aria-hidden loading="lazy" className="block w-full" />
      </motion.div>
      <h2 id="closing-title" className="mx-auto mt-10 max-w-2xl text-[clamp(2rem,5.5vw,3.6rem)] font-bold leading-tight text-ink">
        What is your electricity trying to tell you?
      </h2>
      <div className="mt-10 flex flex-wrap justify-center gap-4">
        <Link href="/analyze/" className={buttonClass("primary", "lg")}>
          <IconBolt size={20} /> Analyze my energy
        </Link>
        <Link href="/analyze/?demo=1" className={buttonClass("secondary", "lg")}>
          <IconFlask size={18} className="text-blue" /> Try demo data
        </Link>
      </div>
      <p className="mt-8 text-sm text-ink-3">Free · in your browser · your data never leaves this device</p>
    </section>
  );
}
