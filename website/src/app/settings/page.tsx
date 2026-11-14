"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { IconCheck, IconDownload, IconShield, IconTrash } from "@/components/icons";
import { Button, ConfirmInline, PageHeader, Segmented } from "@/components/ui";
import { CURRENCIES, currencySymbol } from "@/lib/money";
import {
  STORAGE_KEY,
  clearAllData,
  setPreferences,
  setProfile,
  setTariff,
  storageSizeBytes,
  useAppState,
  type BuildingType,
  type CurrencyCode,
} from "@/lib/storage";

const BUILDINGS: { value: BuildingType; label: string }[] = [
  { value: "home", label: "Home" },
  { value: "apartment", label: "Apartment" },
  { value: "office", label: "Office" },
  { value: "small-business", label: "Small business" },
  { value: "other", label: "Other" },
];

export default function SettingsPage() {
  const state = useAppState()!;
  const router = useRouter();
  const [currency, setCurrency] = useState<CurrencyCode>(state.tariff?.currency ?? "INR");
  const [tariffText, setTariffText] = useState(state.tariff ? String(state.tariff.perKwh) : "");
  const [saved, setSaved] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [bytes, setBytes] = useState(0);
  useEffect(() => setBytes(storageSizeBytes()), [state]);

  const tariff = Number(tariffText);
  const valid = tariffText.trim() !== "" && Number.isFinite(tariff) && tariff > 0 && tariff <= 1000;
  const changed = !state.tariff || state.tariff.currency !== currency || state.tariff.perKwh !== tariff;

  const saveTariff = () => {
    if (!valid) return;
    setTariff({ currency, perKwh: tariff });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wattwise-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Settings" title="Your setup" sub="Everything here is stored only in this browser." />

      <section className="surface p-6 sm:p-7" aria-labelledby="bld-title">
        <h2 id="bld-title" className="font-bold text-ink">
          What are we monitoring?
        </h2>
        <p className="mt-1 text-sm text-ink-2">Used to tailor investigation suggestions.</p>
        <div className="mt-4 overflow-x-auto">
          <Segmented label="Building type" value={state.profile.buildingType ?? "other"} onChange={setProfile} options={BUILDINGS} />
        </div>
      </section>

      <section className="surface p-6 sm:p-7" aria-labelledby="tariff-title">
        <h2 id="tariff-title" className="font-bold text-ink">
          Electricity price
        </h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            saveTariff();
          }}
        >
          <label className="block">
            <span className="text-sm font-semibold text-ink">Currency</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="mt-2 h-12 w-full cursor-pointer rounded-2xl border border-line-strong bg-surface px-4 text-ink"
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
            <div className="mt-2 flex h-12 items-center rounded-2xl border border-line-strong bg-surface px-4 focus-within:border-blue">
              <span className="font-semibold text-ink-3">{currencySymbol(currency)}</span>
              <input
                inputMode="decimal"
                aria-label="Tariff per kWh"
                aria-invalid={!valid}
                value={tariffText}
                onChange={(e) => setTariffText(e.target.value.replace(",", "."))}
                className="num w-full bg-transparent px-2 text-lg font-bold text-ink outline-none"
              />
            </div>
          </label>
          <Button type="submit" disabled={!valid || !changed}>
            Save price
          </Button>
        </form>
        <div className="mt-3 min-h-6 text-sm" aria-live="polite">
          {!valid ? (
            <span className="text-danger">Enter a price greater than 0.</span>
          ) : (
            <AnimatePresence>
              {saved && (
                <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1.5 font-semibold text-sage-strong">
                  <IconCheck size={16} /> Saved. Costs everywhere now use this price.
                </motion.span>
              )}
            </AnimatePresence>
          )}
        </div>
      </section>

      <section className="surface p-6 sm:p-7" aria-labelledby="pref-title">
        <h2 id="pref-title" className="font-bold text-ink">
          Preferences
        </h2>
        <div className="mt-4 space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-semibold text-ink">
              Motion
              <span className="block text-xs font-normal text-ink-3">“System” follows your device’s reduce-motion setting.</span>
            </span>
            <Segmented
              label="Motion"
              value={state.preferences.motion}
              onChange={(motion) => setPreferences({ motion })}
              options={[
                { value: "system", label: "System" },
                { value: "reduced", label: "Reduced" },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="surface p-6 sm:p-7" aria-labelledby="data-title">
        <h2 id="data-title" className="font-bold text-ink">
          Your data
        </h2>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl bg-sunken px-4 py-3">
            <dt className="text-xs text-ink-3">Analyses</dt>
            <dd className="num text-xl font-bold text-ink">{state.analyses.length}</dd>
          </div>
          <div className="rounded-2xl bg-sunken px-4 py-3">
            <dt className="text-xs text-ink-3">Saved bills</dt>
            <dd className="num text-xl font-bold text-ink">{Object.keys(state.bills).length}</dd>
          </div>
          <div className="rounded-2xl bg-sunken px-4 py-3">
            <dt className="text-xs text-ink-3">Storage used</dt>
            <dd className="num text-xl font-bold text-ink">{(bytes / 1024).toFixed(1)} KB</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-ink-3">
          Stored in this browser’s local storage under <code className="num">{STORAGE_KEY}</code>.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={download}>
            <IconDownload size={18} /> Download my data
          </Button>
          {confirmClear ? (
            <ConfirmInline
              prompt="Erase everything and start over?"
              confirmLabel="Erase all data"
              onConfirm={() => {
                clearAllData();
                router.replace("/welcome/");
              }}
              onCancel={() => setConfirmClear(false)}
            />
          ) : (
            <Button variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => setConfirmClear(true)}>
              <IconTrash size={18} /> Clear all local data
            </Button>
          )}
        </div>
      </section>

      <section className="flex gap-4 rounded-3xl bg-sage-soft/70 p-6" aria-labelledby="privacy-title">
        <IconShield size={26} className="shrink-0 text-sage-strong" />
        <div>
          <h2 id="privacy-title" className="font-bold text-ink">
            Privacy
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            Your analysis stays in this browser. This prototype uses local storage. No energy data is sent to a generative AI API, or to any server:
            the trained model runs on your device.
          </p>
        </div>
      </section>
    </div>
  );
}
