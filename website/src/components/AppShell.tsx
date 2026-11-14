"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, type ReactNode } from "react";
import { getStorageError, useAppState } from "@/lib/storage";
import { IconBolt, IconHistory, IconInsights, IconLearn, IconOverview, IconSettings, IconShield } from "./icons";
import { EASE } from "./motion";

const NAV = [
  { href: "/", label: "Overview", Icon: IconOverview },
  { href: "/analyze", label: "Analyze", Icon: IconBolt },
  { href: "/history", label: "History", Icon: IconHistory },
  { href: "/insights", label: "Insights", Icon: IconInsights },
  { href: "/learn", label: "Learn", Icon: IconLearn },
];

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/history") return path === "/history" || path === "/analysis";
  return path === href;
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid size-8 place-items-center rounded-[10px] bg-ink text-white">
        <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden fill="none">
          <path d="M3 14h3.5l2.5-5 3.5 9 3-12 2 8H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="15.5" cy="6" r="2.2" fill="var(--color-amber-bright)" />
        </svg>
      </span>
      <span className="text-[15px] font-extrabold tracking-[0.12em] text-ink">WATTWISE</span>
    </span>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading WATTWISE">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: EASE }}>
        <Logo />
      </motion.div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const state = useAppState();
  const path = norm(usePathname() || "/");
  const router = useRouter();
  const onWelcome = path === "/welcome";
  const needsOnboarding = state !== null && !state.onboarding.completed && !onWelcome;

  useEffect(() => {
    if (needsOnboarding) router.replace("/welcome/");
  }, [needsOnboarding, router]);

  if (state === null || needsOnboarding) return <Splash />;
  if (onWelcome) return <>{children}</>;

  const storageError = getStorageError();

  return (
    <div className="min-h-dvh lg:pl-64">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/70 px-5 py-7 backdrop-blur-xl lg:flex">
        <Link href="/" aria-label="WATTWISE overview">
          <Logo />
        </Link>
        <nav aria-label="Main" className="mt-10">
          <ul className="space-y-1">
            {NAV.map(({ href, label, Icon }) => {
              const active = isActive(path, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`tap relative flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[0.95rem] font-semibold transition-colors ${
                      active ? "text-ink" : "text-ink-2 hover:bg-sunken hover:text-ink"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-2xl bg-sage-soft"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <Icon className={`relative ${active ? "text-sage-strong" : ""}`} />
                    <span className="relative">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="mt-auto space-y-4">
          <Link
            href="/settings"
            aria-current={path === "/settings" ? "page" : undefined}
            className={`tap flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[0.95rem] font-semibold transition-colors ${
              path === "/settings" ? "bg-sage-soft text-ink" : "text-ink-2 hover:bg-sunken hover:text-ink"
            }`}
          >
            <IconSettings /> Settings
          </Link>
          <div className="flex gap-2.5 rounded-2xl bg-sunken p-3.5 text-xs leading-relaxed text-ink-2">
            <IconShield size={18} className="mt-0.5 shrink-0 text-sage" />
            <span>Your data stays in this browser. Nothing is sent to an AI API.</span>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-canvas/85 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/" aria-label="WATTWISE overview">
          <Logo />
        </Link>
        <Link
          href="/settings"
          aria-label="Settings"
          className="tap grid size-11 place-items-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
        >
          <IconSettings />
        </Link>
      </header>

      <main id="content" className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-8 sm:pt-10 lg:pb-16">
        {storageError && (
          <p role="alert" className="mb-6 rounded-2xl bg-amber-soft px-4 py-3 text-sm text-amber">
            {storageError}
          </p>
        )}
        {/* Route transition: each page enters with a short rise + fade. */}
        <motion.div key={path} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: EASE }}>
          {children}
        </motion.div>
      </main>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map(({ href, label, Icon }) => {
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`tap relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${
                    active ? "text-sage-strong" : "text-ink-3"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="tab-active"
                      className="absolute top-0 h-[3px] w-8 rounded-b-full bg-sage"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon size={22} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
