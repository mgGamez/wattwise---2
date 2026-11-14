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

/* ================================================================== scene 1: the layered 3D fridge */
// Built from layers (body, hinged door, interior, shelves, light, shadows) — not a
// screenshot. The door rotates around its left hinge with a real CSS 3D transform,
// so scrolling opens it and scrolling back up closes it again.

type MVN = MotionValue<number> | number;

function FridgeScene({ reduce, sound }: { reduce: boolean; sound: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const p = useSpring(scrollYProgress, { stiffness: 150, damping: 30, restDelta: 0.0005 });

  // camera: subtle push-in, then closer as the light builds
  const cam = useTransform(p, [0, 0.15, 0.3, 0.7, 0.92], [0.92, 0.94, 1, 1.06, 1.17]);
  const camY = useTransform(p, [0, 1], ["1.5%", "-3%"]);
  const bgY = useTransform(p, [0, 1], [0, -60]);
  // the door: a tiny latch nudge, then a progressive swing to ~105°
  const door = useTransform(p, [0.24, 0.28, 0.31, 0.5, 0.72], [0, -2.5, -1, -56, -105]);
  // interior light + warm spill onto the scene
  const light = useTransform(p, [0.32, 0.7, 0.9], [0, 0.5, 1]);
  const spill = useTransform(p, [0.42, 0.9], [0, 0.5]);
  // shadows deepen and spread as the door swings out
  const shadowO = useTransform(p, [0, 0.7], [0.4, 0.55]);
  const shadowX = useTransform(p, [0.3, 0.72], [1, 1.22]);
  const doorShadow = useTransform(p, [0.32, 0.72], [0, 0.28]);
  const doorShade = useTransform(door, [-105, 0], [0.32, 0]);
  // copy + button sequencing
  const intro = useTransform(p, [0, 0.14], [1, 0]);
  const openCopy = useTransform(p, [0.86, 0.95], [0, 1]);
  const btnO = useTransform(p, [0.88, 0.96], [0, 1]);
  const btnS = useTransform(p, [0.88, 0.98], [0.85, 1]);

  const [open, setOpen] = useState(false);
  const last = useRef(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setOpen(v > 0.86);
    if (sound && last.current < 0.28 && v >= 0.28) playLatch();
    if (sound && last.current < 0.45 && v >= 0.45) playWhoosh();
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

  const analyzeButton = (
    <motion.div style={reduce ? undefined : { opacity: btnO, scale: btnS }}>
      <Link
        href="/analyze/"
        onClick={enter}
        tabIndex={showButton ? 0 : -1}
        aria-hidden={!showButton}
        className={
          "flex h-12 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-6 text-[0.95rem] font-semibold text-white shadow-[0_18px_40px_-12px_rgb(29_32_36/0.65)] transition-transform hover:scale-[1.05] active:scale-[0.97] sm:h-[3.4rem] sm:px-7 sm:text-[1.05rem] " +
          (showButton ? "" : "pointer-events-none")
        }
      >
        <IconBolt size={20} /> Analyze Now
      </Link>
    </motion.div>
  );

  if (reduce)
    return (
      <section aria-label="Open your energy story" className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 pt-20" style={{ background: "#dbc3b1" }}>
        <h1 className="text-center text-3xl font-bold text-ink">Open your energy story.</h1>
        <Fridge door={-105} doorShade={0.32} light={1} spill={0.4} shadowO={0.5} shadowX={1.2} doorShadow={0.25} button={analyzeButton} />
        <p className="max-w-sm text-center font-semibold text-ink-2">See what your electricity is really telling you.</p>
      </section>
    );

  return (
    <section ref={ref} aria-label="Open your energy story — scroll to open the fridge" className="relative h-[320vh]" style={{ background: "#dbc3b1" }}>
      <div className="sticky top-0 flex h-dvh flex-col items-center justify-center overflow-hidden px-4">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-[-10%]"
          style={{ y: bgY, background: "radial-gradient(60% 55% at 50% 40%, rgb(255 243 226 / 0.6), transparent 70%)" }}
        />
        {/* camera */}
        <motion.div style={{ scale: cam, y: camY }} className="will-change-transform">
          <Fridge door={door} doorShade={doorShade} light={light} spill={spill} shadowO={shadowO} shadowX={shadowX} doorShadow={doorShadow} button={analyzeButton} />
        </motion.div>

        <motion.p style={{ opacity: intro }} className="pointer-events-none absolute bottom-7 flex flex-col items-center gap-1.5 text-sm font-semibold text-ink-2">
          Scroll to explore
          <motion.span animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} aria-hidden>
            ↓
          </motion.span>
        </motion.p>
        <motion.p style={{ opacity: openCopy }} aria-hidden className="pointer-events-none absolute bottom-7 max-w-sm px-6 text-center text-base font-bold text-ink sm:text-lg">
          See what your electricity is really telling you.
        </motion.p>
      </div>

      <AnimatePresence>
        {leaving && (
          <motion.div
            className="fixed inset-0 z-50 bg-canvas"
            initial={{ clipPath: "circle(0% at 50% 50%)" }}
            animate={{ clipPath: "circle(150% at 50% 50%)" }}
            transition={{ duration: 0.5, ease: EASE }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * The fridge itself. The root sets font-size to 1% of its own width, so every
 * "em" below is a percentage of fridge width — the whole object scales as one.
 * The door is a real 3D panel (front face, inner face, edge) rotating around
 * its left hinge inside a perspective container.
 */
function Fridge({ door, doorShade, light, spill, shadowO, shadowX, doorShadow, button }: { door: MVN; doorShade: MVN; light: MVN; spill: MVN; shadowO: MVN; shadowX: MVN; doorShadow: MVN; button: ReactNode }) {
  const shelfTops = ["30%", "52%", "74%"];
  return (
    <div style={{ perspective: "1100px" }}>
      <div className="relative" style={{ width: "min(76vw, 380px)", fontSize: "calc(min(76vw, 380px) / 100)", aspectRatio: "100 / 138" }}>
        {/* contact shadow */}
        <motion.div
          aria-hidden
          className="absolute bottom-[-2em] left-1/2 h-[7em] w-[88%] -translate-x-1/2 rounded-[50%] bg-[#7d6350]"
          style={{ opacity: shadowO, scaleX: shadowX, filter: "blur(2em)" }}
        />
        {/* shadow the open door casts to the left */}
        <motion.div aria-hidden className="absolute bottom-[-1em] left-[-38%] h-[9em] w-[62%] rounded-[50%] bg-[#6e564a]" style={{ opacity: doorShadow, filter: "blur(2.6em)" }} />

        {/* feet */}
        <div aria-hidden className="absolute bottom-0 left-[16%] h-[4.5em] w-[8em] rounded-b-[2em] bg-gradient-to-b from-[#cdc5b6] to-[#968c7b]" />
        <div aria-hidden className="absolute bottom-0 right-[16%] h-[4.5em] w-[8em] rounded-b-[2em] bg-gradient-to-b from-[#cdc5b6] to-[#968c7b]" />

        {/* body */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-[3.5em] top-0 rounded-[11em] bg-gradient-to-br from-[#fdfaf4] via-[#f4efe5] to-[#e2dac9]"
          style={{ boxShadow: "0 3em 7em -2em rgb(90 70 50 / 0.5), inset -2em 0 4em rgb(125 100 75 / 0.14), inset 2em 2em 3em rgb(255 255 255 / 0.85), inset 0 -2em 4em rgb(125 100 75 / 0.16)" }}
        />

        {/* interior cavity (revealed by the door) */}
        <div className="absolute bottom-[9%] left-[7%] right-[7%] top-[5%] overflow-hidden rounded-[6em] bg-[#ece4d4]" style={{ boxShadow: "inset 0 0 7em rgb(95 75 55 / 0.45), inset 0 -2.5em 5em rgb(110 88 66 / 0.25)" }}>
          {/* back wall */}
          <div aria-hidden className="absolute inset-[6%] rounded-[5em]" style={{ background: "radial-gradient(85% 75% at 50% 38%, #fbf4e4, #e6ddc9 78%)" }} />
          {/* side walls */}
          <div aria-hidden className="absolute bottom-0 left-0 top-0 w-[10%]" style={{ background: "linear-gradient(90deg, rgb(110 88 66 / 0.3), transparent)" }} />
          <div aria-hidden className="absolute bottom-0 right-0 top-0 w-[10%]" style={{ background: "linear-gradient(-90deg, rgb(110 88 66 / 0.3), transparent)" }} />
          {/* ceiling lamp */}
          <div aria-hidden className="absolute left-1/2 top-[5.5%] h-[2.6em] w-[44%] -translate-x-1/2 rounded-full bg-[#fff3d2]" style={{ boxShadow: "0 0.5em 2em 0.5em rgb(255 220 150 / 0.8)" }} />
          <motion.div aria-hidden className="absolute left-1/2 top-[3%] h-[26%] w-[70%] -translate-x-1/2 rounded-[50%] bg-[#ffe9bd]" style={{ opacity: light, filter: "blur(3em)" }} />
          {/* shelves: top surface + front edge */}
          {shelfTops.map((top) => (
            <div key={top} aria-hidden className="absolute left-[10%] right-[10%]" style={{ top }}>
              <div className="h-[3em] rounded-[1em]" style={{ background: "linear-gradient(180deg, #fffdf4, #eee5d2)" }} />
              <div className="h-[1.4em] rounded-b-[1em]" style={{ background: "linear-gradient(180deg, #f4ecda, #d9cfb9)", boxShadow: "0 1.2em 1.6em -0.6em rgb(110 88 66 / 0.45)" }} />
            </div>
          ))}
          {/* warm light wash over everything inside */}
          <motion.div aria-hidden className="pointer-events-none absolute inset-0" style={{ opacity: light, background: "radial-gradient(70% 60% at 50% 26%, rgb(255 216 150 / 0.55), rgb(255 232 190 / 0.18) 60%, transparent 85%)" }} />
          {/* the real button, inside the fridge */}
          <div className="absolute inset-0 grid place-items-center">{button}</div>
        </div>

        {/* warm light spilling out of the open fridge */}
        <motion.div aria-hidden className="pointer-events-none absolute bottom-[8%] left-[-24%] top-[6%] w-[70%] rounded-[50%] bg-[#ffd9a2]" style={{ opacity: spill, filter: "blur(4em)" }} />

        {/* the door: front face + inner face + swinging edge, hinged on the left */}
        <motion.div
          data-testid="fridge-door"
          aria-hidden
          className="absolute bottom-[9%] left-[7%] right-[7%] top-[5%] will-change-transform"
          style={{ transformOrigin: "left center", rotateY: door, transformStyle: "preserve-3d", z: 2 }}
        >
          {/* front face */}
          <div
            className="absolute inset-0 rounded-[6em] bg-gradient-to-br from-white via-[#f7f2e8] to-[#e7dfce]"
            style={{ backfaceVisibility: "hidden", boxShadow: "inset 1.5em 1.5em 2.5em rgb(255 255 255 / 0.9), inset -1.5em -1.5em 3em rgb(125 100 75 / 0.12), 0 0.5em 2em rgb(90 70 50 / 0.18)" }}
          >
            <p className="px-[12%] pt-[22%] text-center font-bold leading-[1.18] text-ink" style={{ fontSize: "8em" }}>
              Open your energy story.
            </p>
            {/* handle */}
            <div className="absolute right-[8%] top-1/2 h-[19em] w-[2.8em] -translate-y-1/2 rounded-full bg-gradient-to-b from-[#eceef0] via-[#b4b8bf] to-[#878c93]" style={{ boxShadow: "0.4em 0.8em 1.4em rgb(80 70 60 / 0.45), inset 0.4em 0 0.6em rgb(255 255 255 / 0.8)" }} />
            <div className="absolute right-[9.2%] top-[33.5%] h-[1.6em] w-[5em] rounded-full bg-[#9aa0a7]" />
            <div className="absolute right-[9.2%] bottom-[33.5%] h-[1.6em] w-[5em] rounded-full bg-[#9aa0a7]" />
            <motion.div aria-hidden className="absolute inset-0 rounded-[6em]" style={{ opacity: doorShade, background: "linear-gradient(105deg, rgb(90 72 55 / 0.12), rgb(90 72 55 / 0.55))" }} />
          </div>
          {/* door thickness (the edge you see while it swings) */}
          <div className="absolute bottom-[1%] right-0 top-[1%] w-[3.4em] rounded-[1em]" style={{ transformOrigin: "right center", transform: "rotateY(-90deg)", background: "linear-gradient(90deg, #efe8d9, #cbc2ad)" }} />
          {/* inner face with door racks */}
          <div className="absolute inset-0 rounded-[6em] bg-[#f3eddf]" style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden", boxShadow: "inset 0 0 4em rgb(110 88 66 / 0.25)" }}>
            <div className="absolute left-[10%] right-[10%] top-[30%] h-[7em] rounded-[1.5em] bg-gradient-to-b from-[#faf5e9] to-[#ded5c0]" />
            <div className="absolute left-[10%] right-[10%] top-[62%] h-[7em] rounded-[1.5em] bg-gradient-to-b from-[#faf5e9] to-[#ded5c0]" />
          </div>
        </motion.div>
      </div>
    </div>
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
