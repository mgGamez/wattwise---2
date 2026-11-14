"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Logo } from "@/components/AppShell";
import { IconApartment, IconArrowLeft, IconArrowRight, IconCheck, IconDots, IconHome, IconOffice, IconStore } from "@/components/icons";
import { EASE, SPRING, useReduceMotion } from "@/components/motion";
import { Button, PrivacyNote } from "@/components/ui";
import { CURRENCIES, currencySymbol, fmtMoney } from "@/lib/money";
import { completeOnboarding, useAppState, type BuildingType, type CurrencyCode } from "@/lib/storage";

const BUILDINGS: { value: BuildingType; label: string; Icon: typeof IconHome }[] = [
  { value: "home", label: "Home", Icon: IconHome },
  { value: "apartment", label: "Apartment", Icon: IconApartment },
  { value: "office", label: "Office", Icon: IconOffice },
  { value: "small-business", label: "Small business", Icon: IconStore },
  { value: "other", label: "Other", Icon: IconDots },
];

export default function Welcome() {
  const state = useAppState();
  const router = useRouter();
  const reduce = useReduceMotion();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [building, setBuilding] = useState<BuildingType | null>(state?.profile.buildingType ?? null);
  const [currency, setCurrency] = useState<CurrencyCode>(state?.tariff?.currency ?? "INR");
  const [tariffText, setTariffText] = useState(state?.tariff ? String(state.tariff.perKwh) : "");
  const [touched, setTouched] = useState(false);

  const tariff = Number(tariffText);
  const tariffValid = tariffText.trim() !== "" && Number.isFinite(tariff) && tariff > 0 && tariff <= 1000;
  const go = (to: number) => {
    setDir(to > step ? 1 : -1);
    setStep(to);
  };
  const finish = () => {
    if (!building || !tariffValid) return;
    completeOnboarding(building, { currency, perKwh: tariff });
    router.push("/analyze/");
  };

  const slide = {
    initial: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * 40 }),
    animate: { opacity: 1, x: 0 },
    exit: (d: number) => (reduce ? { opacity: 0 } : { opacity: 0, x: d * -40 }),
  };

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <BackgroundFlow />
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10">
        <Logo />
        {step > 0 && (
          <div className="flex items-center gap-1.5" aria-label={`Step ${step} of 3`}>
            {[1, 2, 3].map((i) => (
              <span key={i} className="relative h-1.5 w-10 overflow-hidden rounded-full bg-line">
                <motion.span
                  className="absolute inset-y-0 left-0 rounded-full bg-sage"
                  initial={false}
                  animate={{ width: step >= i ? "100%" : "0%" }}
                  transition={{ duration: 0.4, ease: EASE }}
                />
              </span>
            ))}
          </div>
        )}
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-5 pb-16">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.section
            key={step}
            custom={dir}
            variants={slide}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.38, ease: EASE }}
            aria-live="polite"
          >
            {step === 0 && (
              <div className="text-center">
                <motion.div initial={reduce ? false : { scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING}>
                  <span className="mx-auto grid size-20 place-items-center rounded-[26px] bg-ink text-white shadow-[0_20px_40px_-18px_rgb(29_32_36/0.6)]">
                    <svg viewBox="0 0 24 24" className="size-10" aria-hidden fill="none">
                      <motion.path
                        d="M3 14h3.5l2.5-5 3.5 9 3-12 2 8H21"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={reduce ? false : { pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
                      />
                      <circle cx="15.5" cy="6" r="2.2" fill="var(--color-amber-bright)" />
                    </svg>
                  </span>
                </motion.div>
                <h1 className="mt-8 text-[2.6rem] font-extrabold tracking-[0.08em] text-ink sm:text-5xl">WATTWISE</h1>
                <p className="mx-auto mt-4 max-w-sm text-lg leading-relaxed text-ink-2">
                  Understand unusual energy use before it becomes a pattern.
                </p>
                <Button size="lg" className="mt-10" onClick={() => go(1)}>
                  Get started <IconArrowRight size={18} />
                </Button>
                <div className="mx-auto mt-10 max-w-sm">
                  <PrivacyNote compact />
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <p className="label-caps">Step 1 of 3</p>
                <h1 className="mt-2 text-[2rem] font-bold leading-tight text-ink">What are we monitoring?</h1>
                <p className="mt-2 text-ink-2">This helps WATTWISE tailor what it suggests you check.</p>
                <div role="radiogroup" aria-label="Building type" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {BUILDINGS.map(({ value, label, Icon }, i) => {
                    const active = building === value;
                    return (
                      <motion.button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setBuilding(value)}
                        initial={reduce ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...SPRING, delay: i * 0.05 }}
                        whileTap={{ scale: 0.97 }}
                        className={`tap relative flex h-28 cursor-pointer flex-col items-start justify-between rounded-3xl border p-4 text-left transition-colors ${
                          active ? "border-sage bg-sage-soft" : "border-line bg-surface hover:border-line-strong"
                        }`}
                      >
                        <Icon size={26} className={active ? "text-sage-strong" : "text-ink-2"} />
                        <span className="font-semibold text-ink">{label}</span>
                        {active && (
                          <motion.span
                            layoutId="building-check"
                            className="absolute right-3 top-3 grid size-6 place-items-center rounded-full bg-sage text-white"
                            transition={{ type: "spring", stiffness: 420, damping: 30 }}
                          >
                            <IconCheck size={14} />
                          </motion.span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
                <div className="mt-10 flex items-center justify-between">
                  <Button variant="ghost" onClick={() => go(0)}>
                    <IconArrowLeft size={18} /> Back
                  </Button>
                  <Button onClick={() => go(2)} disabled={!building}>
                    Continue <IconArrowRight size={18} />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setTouched(true);
                  if (tariffValid) go(3);
                }}
              >
                <p className="label-caps">Step 2 of 3</p>
                <h1 className="mt-2 text-[2rem] font-bold leading-tight text-ink">Electricity price</h1>
                <p className="mt-2 text-ink-2">Used to turn unusual energy into an estimated cost. You’ll find it on your bill as the price per kWh.</p>
                <div className="mt-8 space-y-5">
                  <label className="block">
                    <span className="text-sm font-semibold text-ink">Currency</span>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                      className="mt-2 h-14 w-full cursor-pointer rounded-2xl border border-line-strong bg-surface px-4 text-base text-ink"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-ink">Tariff per kWh</span>
                    <div className="mt-2 flex h-16 items-center rounded-2xl border border-line-strong bg-surface px-4 focus-within:border-blue">
                      <span className="text-xl font-semibold text-ink-3">{currencySymbol(currency)}</span>
                      <input
                        inputMode="decimal"
                        value={tariffText}
                        onChange={(e) => setTariffText(e.target.value.replace(",", "."))}
                        onBlur={() => setTouched(true)}
                        aria-invalid={touched && !tariffValid}
                        aria-describedby="tariff-help"
                        className="num h-full w-full bg-transparent px-2 text-2xl font-bold text-ink outline-none"
                        autoFocus
                      />
                      <span className="shrink-0 text-sm font-medium text-ink-3">per kWh</span>
                    </div>
                    <span id="tariff-help" className={`mt-2 block text-sm ${touched && !tariffValid ? "text-danger" : "text-ink-3"}`}>
                      {touched && !tariffValid ? "Enter a price greater than 0 (for example 8.5)." : "You can change this later in Settings."}
                    </span>
                  </label>
                </div>
                <div className="mt-10 flex items-center justify-between">
                  <Button variant="ghost" onClick={() => go(1)}>
                    <IconArrowLeft size={18} /> Back
                  </Button>
                  <Button type="submit">
                    Continue <IconArrowRight size={18} />
                  </Button>
                </div>
              </form>
            )}

            {step === 3 && building && tariffValid && (
              <div>
                <p className="label-caps">Step 3 of 3</p>
                <h1 className="mt-2 text-[2.4rem] font-bold leading-tight text-ink">Ready.</h1>
                <div className="surface mt-8 divide-y divide-line">
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-ink-2">Monitoring</span>
                    <span className="font-semibold text-ink">{BUILDINGS.find((b) => b.value === building)?.label}</span>
                  </div>
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-ink-2">Electricity price</span>
                    <span className="num font-semibold text-ink">{fmtMoney(tariff, currency)} / kWh</span>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-relaxed text-ink-2">
                  WATTWISE learns what’s normal for you from your own monthly bills. Keep a few past bills handy: you’ll need the kWh (units) from at
                  least three earlier months.
                </p>
                <Button size="lg" className="mt-8 w-full" onClick={finish}>
                  Start analyzing <IconArrowRight size={18} />
                </Button>
                <Button variant="ghost" className="mt-3 w-full" onClick={() => go(2)}>
                  <IconArrowLeft size={18} /> Back
                </Button>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
}

/** Soft animated energy lines behind the onboarding (decorative). */
function BackgroundFlow() {
  const reduce = useReduceMotion();
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh] w-full" viewBox="0 0 1200 400" preserveAspectRatio="none">
      <defs>
        <linearGradient id="wf" x1="0" x2="1">
          <stop offset="0" stopColor="#6fa57f" stopOpacity="0" />
          <stop offset="0.5" stopColor="#6fa57f" stopOpacity="0.35" />
          <stop offset="1" stopColor="#6c9ad6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2].map((i) => (
        <motion.path
          key={i}
          d={`M0 ${300 - i * 40} C 200 ${240 - i * 30}, 380 ${340 - i * 20}, 600 ${280 - i * 40} S 1000 ${200 - i * 30}, 1200 ${260 - i * 40}`}
          fill="none"
          stroke="url(#wf)"
          strokeWidth={2 - i * 0.4}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.2, delay: 0.2 + i * 0.25, ease: EASE }}
        />
      ))}
    </svg>
  );
}
