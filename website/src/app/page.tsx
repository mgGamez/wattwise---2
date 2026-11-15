"use client";

// WATTWISE landing: just the fridge. Scrolling opens it; the Analyze Now button
// inside is the way into the app.

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/AppShell";
import { FridgeScrollHero } from "@/components/landing/FridgeScrollHero";
import { buttonClass } from "@/components/ui";
import { enableSound, playLatch } from "@/lib/sounds";

export default function Landing() {
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

      <FridgeScrollHero sound={sound} />
    </div>
  );
}
