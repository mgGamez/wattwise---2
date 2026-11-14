"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { href: "#anomaly", label: "Result" },
  { href: "#how", label: "How it works" },
  { href: "#evidence", label: "Evidence" },
  { href: "#explorer", label: "Explorer" },
  { href: "#failures", label: "Failures" },
  { href: "#limits", label: "Limits" },
];

export function Nav() {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const ids = ["top", ...LINKS.map((l) => l.href.slice(1))];
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id === "top" ? null : visible.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-bg/70 backdrop-blur-xl backdrop-saturate-150">
      <nav aria-label="Primary" className="container-page flex h-14 items-center justify-between gap-6">
        <a href="#top" className="flex items-center gap-2.5 font-semibold tracking-[0.14em] text-ink text-sm">
          <Mark />
          WATTWISE
        </a>
        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const isActive = active === l.href.slice(1);
            return (
              <li key={l.href}>
                <a
                  href={l.href}
                  aria-current={isActive ? "location" : undefined}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-200 ${
                    isActive ? "bg-white/[0.07] text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {l.label}
                </a>
              </li>
            );
          })}
        </ul>
        <a href="#evidence" className="rounded-full border border-line-strong px-3.5 py-1.5 text-sm text-ink md:hidden">
          Evidence
        </a>
      </nav>
    </header>
  );
}

export function Mark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none">
      <path d="M2 14 L6 14 L8.5 9 L11.5 18 L14 6 L16.5 14 L22 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="14" cy="6" r="2.2" fill="var(--color-unexpected)" />
    </svg>
  );
}
