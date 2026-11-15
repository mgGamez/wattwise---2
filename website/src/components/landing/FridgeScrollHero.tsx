"use client";

// Scroll-scrubbed fridge hero. The pinned section's scroll progress IS the video's
// playhead: scrolling down opens the fridge, stopping holds it, scrolling up closes
// it again. All copy and the Analyze Now button are real HTML overlays — nothing is
// baked into the clip by us.
//
// To swap the clip later, replace /public/media/wattwise-fridge.mp4 on disk with a
// file of the same name — no code changes needed.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { IconBolt } from "@/components/icons";
import { EASE, useReduceMotion } from "@/components/motion";
import { playLatch, playWhoosh } from "@/lib/sounds";

const VIDEO_SRC = "/media/wattwise-fridge.mp4";
// Warm beige matched to the clip's own background, so the frame melts into the page.
const BG = "#d8bfae";
// The clip's fridge sits left of frame centre; nudge the video right so the heading is centred on it.
const FRIDGE_SHIFT = "2.7%";
// Where the open interior sits in the 16:9 frame (fractions of the video box).
const BUTTON_POS = { left: "46.7%", top: "52%" }; // 44% inside the clip + FRIDGE_SHIFT
// Analyze Now shows once the scrubbed clip reaches this second.
const BUTTON_AT_S = 1.8;

/**
 * Fetch the clip once and scrub a blob URL: blobs are always fully seekable
 * (hosts without HTTP Range support would otherwise ignore currentTime), the
 * whole file is preloaded, and the browser never re-requests it while scrubbing.
 */
function useVideoBlobUrl() {
  const [url, setUrl] = useState(VIDEO_SRC);
  useEffect(() => {
    let obj: string | null = null;
    let alive = true;
    fetch(VIDEO_SRC)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b && alive) {
          obj = URL.createObjectURL(b);
          setUrl(obj);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (obj) URL.revokeObjectURL(obj);
    };
  }, []);
  return url;
}

export function FridgeScrollHero({ sound }: { sound: boolean }) {
  const videoUrl = useVideoBlobUrl();
  const reduce = useReduceMotion();
  const router = useRouter();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  // Spring-smoothed playhead: scrubbing feels weighted instead of twitchy.
  const p = useSpring(scrollYProgress, { stiffness: 150, damping: 30, restDelta: 0.0003 });
  // Hold the closed frame briefly at the start and the open frame at the end.
  const timeP = useTransform(p, [0.08, 0.95], [0, 1]);

  // camera: gentle settle-in, then a subtle push toward the open interior
  const camScale = useTransform(p, [0, 0.25, 0.85, 1], [0.95, 1, 1, 1.035]);
  // copy choreography
  const introO = useTransform(p, [0, 0.2, 0.35], [1, 1, 0]);
  const introY = useTransform(p, [0, 0.35], [0, -24]);
  const captionO = useTransform(p, [0.86, 0.96], [0, 1]);

  const [open, setOpen] = useState(false);
  // Seek loop: rAF reads the motion value and nudges video.currentTime — no React
  // state per scroll frame, and we never fight an in-flight seek.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && v.readyState >= 1 && Number.isFinite(v.duration) && !v.seeking) {
        const t = timeP.get() * Math.max(v.duration - 0.05, 0);
        if (Math.abs(v.currentTime - t) > 0.02) v.currentTime = t;
        setOpen(t >= BUTTON_AT_S);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timeP]);

  const last = useRef(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (sound && last.current < 0.28 && v >= 0.28) playLatch();
    if (sound && last.current < 0.45 && v >= 0.45) playWhoosh();
    last.current = v;
  });
  // Scrubbing is user-driven, so it stays on even with reduced motion (only the camera push is dropped).
  const showButton = open;

  // click-to-enter: warm light expands from the interior, then the real Analyze opens
  const [leaving, setLeaving] = useState(false);
  const enter = (e: React.MouseEvent) => {
    e.preventDefault();
    if (reduce || leaving) {
      router.push("/analyze/");
      return;
    }
    setLeaving(true);
    setTimeout(() => router.push("/analyze/"), 450);
  };

  const analyzeButton = (
    <motion.div
      initial={false}
      animate={showButton ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.92, y: 15 }}
      transition={{ duration: showButton ? 0.35 : 0.2, ease: EASE }}
    >
      <Link
        href="/analyze/"
        onClick={enter}
        tabIndex={showButton ? 0 : -1}
        aria-hidden={!showButton}
        className={
          "shimmer flex h-11 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-5 text-sm font-semibold text-white shadow-[0_16px_36px_-12px_rgb(29_32_36/0.6)] transition-transform hover:scale-[1.05] active:scale-[0.97] sm:h-[3.3rem] sm:px-7 sm:text-[1.05rem] " +
          (showButton ? "" : "pointer-events-none")
        }
      >
        <IconBolt size={20} /> Analyze Now
      </Link>
    </motion.div>
  );

  const introCopy = (
    <>
      <p className="text-sm font-extrabold tracking-[0.28em] text-ink sm:text-base">WATTWISE</p>
      <h1 className="mt-2 font-display text-2xl leading-tight text-ink sm:text-4xl">
        See what your
        <br />
        electricity is telling you.
      </h1>
    </>
  );

  return (
    <section
      ref={sectionRef}
      aria-label="See what your electricity is telling you"
      className="relative h-[220vh] md:h-[300vh]"
      style={{ background: BG }}
    >
      <div className="sticky top-0 h-svh overflow-hidden" style={{ background: BG }}>
        {/* the video box keeps the clip's 16:9 proportions; overlays live in its coordinates */}
        <div className="absolute inset-0 grid place-items-center">
          <motion.div
            className="relative will-change-transform"
            style={{ scale: reduce ? 1 : camScale, aspectRatio: "16 / 9", width: "min(100%, calc(100svh * 16 / 9))" }}
          >
            <video
              ref={videoRef}
              data-testid="fridge-video"
              src={videoUrl}
              muted
              playsInline
              preload="auto"
              disablePictureInPicture
              aria-hidden
              tabIndex={-1}
              className="absolute inset-0 size-full object-contain"
              style={{ transform: `translateX(${FRIDGE_SHIFT})` }}
            />
            {/* soft vignette so the frame edges blend into the page */}
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ transform: `translateX(${FRIDGE_SHIFT})`, background: `radial-gradient(ellipse 95% 92% at 50% 50%, transparent 55%, ${BG} 96%)` }} />

            {/* intro copy, near the closed door */}
            <motion.div style={{ opacity: introO, y: introY }} className="pointer-events-none absolute bottom-full left-1/2 mb-5 -translate-x-1/2 text-center sm:bottom-auto sm:mb-0 sm:top-[12%]">
              {introCopy}
            </motion.div>

            {/* the real button, inside the open interior */}
            <div className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center" style={BUTTON_POS}>
              {analyzeButton}
            </div>

            {/* small caption once open */}
            <motion.p style={{ opacity: captionO }} aria-hidden className="pointer-events-none absolute inset-x-0 top-full mt-5 text-center text-sm font-bold text-ink sm:bottom-[4%] sm:top-auto sm:mt-0 sm:text-base">
              See what your electricity is really telling you.
            </motion.p>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>
        {leaving && (
          <motion.div
            className="fixed inset-0 z-50 bg-canvas"
            initial={{ clipPath: `circle(0% at ${BUTTON_POS.left} ${BUTTON_POS.top})` }}
            animate={{ clipPath: `circle(150% at ${BUTTON_POS.left} ${BUTTON_POS.top})` }}
            transition={{ duration: 0.5, ease: EASE }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
