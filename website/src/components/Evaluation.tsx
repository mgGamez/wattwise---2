"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState } from "react";
import type { ModelData } from "@/lib/types";
import { fmtDate, fmtNum, fmtShortDate } from "@/lib/format";
import { CountUp, EASE, Reveal } from "./motion";
import { Section, SectionHeader, Unavailable } from "./ui";

type Metric = "mae" | "rmse";

export function Evaluation({ model }: { model: ModelData | null }) {
  const [metric, setMetric] = useState<Metric>("mae");

  return (
    <Section id="evidence" labelledBy="evidence-title" className="border-t border-line">
      <SectionHeader
        id="evidence-title"
        eyebrow="Evidence"
        title="Does the AI actually work?"
        lede="We split the data by time. Models were compared on a validation period. The chosen model was then tested once on a final period it had never seen."
      />
      {!model ? (
        <Unavailable what="Model evaluation" />
      ) : (
        <>
          <Reveal className="mt-12">
            <Timeline model={model} />
          </Reveal>

          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            {/* ---- Validation comparison */}
            <Reveal className="panel p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Step 1 · Validation</p>
                  <h3 className="mt-2 text-lg font-medium">Choosing the model</h3>
                </div>
                <div role="group" aria-label="Error metric" className="flex rounded-full border border-line p-1">
                  {(["mae", "rmse"] as Metric[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={metric === m}
                      onClick={() => setMetric(m)}
                      className={`relative h-9 min-w-16 cursor-pointer rounded-full px-3 text-sm transition-colors ${
                        metric === m ? "text-bg" : "text-ink-2 hover:text-ink"
                      }`}
                    >
                      {metric === m && (
                        <motion.span layoutId="metric-pill" className="absolute inset-0 rounded-full bg-ink" transition={{ duration: 0.3, ease: EASE }} />
                      )}
                      <span className="relative">{m.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              </div>
              <ValidationBars model={model} metric={metric} />
              <p className="mt-6 text-xs leading-relaxed text-ink-3">
                Lower is better. Errors are in Wh per 10-minute interval. {model.selected.name} had the lowest validation MAE,
                so it was selected. The test period was not used for this choice.
              </p>
            </Reveal>

            {/* ---- Final test */}
            <Reveal delay={0.08} className="panel relative overflow-hidden p-6 sm:p-8">
              <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-20 size-72 rounded-full bg-positive/10 blur-3xl" />
              <p className="eyebrow">Step 2 · Final test, evaluated once</p>
              <h3 className="mt-2 text-lg font-medium">{model.selected.name} vs baseline on unseen data</h3>

              <div className="mt-8 grid gap-8 sm:grid-cols-2">
                <FinalMetric
                  label="Average error (MAE)"
                  improvement={model.finalTest.improvement.mae}
                  baseline={model.finalTest.baseline.mae}
                  value={model.finalTest.model.mae}
                />
                <FinalMetric
                  label="Large-miss error (RMSE)"
                  improvement={model.finalTest.improvement.rmse}
                  baseline={model.finalTest.baseline.rmse}
                  value={model.finalTest.model.rmse}
                />
              </div>
              <p className="mt-8 text-xs leading-relaxed text-ink-3">
                Baseline = the training-period average for the same weekday and hour. Improvement = (baseline − model) ÷ baseline.
              </p>
            </Reveal>
          </div>

          {model.persistence && (
            <Reveal className="mt-4">
              <div className="panel flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:gap-8 sm:p-8">
                <p className="eyebrow shrink-0 sm:w-40 sm:pt-1">Honest context</p>
                <p className="text-[0.95rem] leading-relaxed text-ink-2">
                  A simple rule, <span className="text-ink">“copy the previous 10-minute reading”</span>, scores MAE{" "}
                  <span className="num text-ink">{fmtNum(model.persistence.test.mae, 2)}</span> and RMSE{" "}
                  <span className="num text-ink">{fmtNum(model.persistence.test.rmse, 2)}</span> on the same test period. The
                  model’s advantage over it is small on average error ({fmtNum(model.finalTest.model.mae, 2)} vs{" "}
                  {fmtNum(model.persistence.test.mae, 2)}) and clearer on large misses ({fmtNum(model.finalTest.model.rmse, 2)} vs{" "}
                  {fmtNum(model.persistence.test.rmse, 2)}). Short-term appliance use is hard to predict from the past.
                </p>
              </div>
            </Reveal>
          )}

          <Reveal className="mt-4 grid gap-4 sm:grid-cols-2">
            <Glossary term="MAE" text="Mean absolute error: on average, how far the prediction is from the real reading." />
            <Glossary term="RMSE" text="Root mean squared error: like MAE, but large misses count much more." />
          </Reveal>
        </>
      )}
    </Section>
  );
}

function ValidationBars({ model, metric }: { model: ModelData; metric: Metric }) {
  const rows = model.validation;
  const max = Math.max(...rows.map((r) => r[metric]));
  const ref = useRef<HTMLUListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  return (
    <ul ref={ref} className="mt-8 space-y-5">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className={`flex items-center gap-2 ${r.selected ? "text-ink" : "text-ink-2"}`}>
              {r.name}
              {r.selected && (
                <span className="rounded-full border border-expected/40 bg-expected/10 px-2 py-0.5 text-[11px] text-expected">Selected</span>
              )}
            </span>
            <span className={`num ${r.selected ? "text-ink" : "text-ink-2"}`}>{fmtNum(r[metric], 2)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.04]">
            <motion.div
              className={`h-full origin-left rounded-full ${
                r.selected ? "bg-expected" : r.name === "Baseline" ? "bg-ink-3/60" : "bg-ink-2/40"
              }`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: inView ? r[metric] / max : 0 }}
              transition={{ duration: 0.8, ease: EASE }}
              style={{ width: "100%" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FinalMetric({ label, improvement, baseline, value }: { label: string; improvement: number; baseline: number; value: number }) {
  return (
    <div>
      <p className="text-sm text-ink-2">{label}</p>
      <p className="num mt-3 text-5xl font-medium text-positive sm:text-6xl">
        <CountUp value={improvement} digits={1} suffix="%" />
      </p>
      <p className="mt-1 text-sm text-ink-2">lower than the baseline</p>
      <dl className="mt-5 space-y-1.5 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-3">Baseline</dt>
          <dd className="num text-ink-2">{fmtNum(baseline, 2)} Wh</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-3">WATTWISE</dt>
          <dd className="num text-ink">{fmtNum(value, 2)} Wh</dd>
        </div>
      </dl>
    </div>
  );
}

function Timeline({ model }: { model: ModelData }) {
  // Shares computed from the real period lengths.
  const span = (r: [string, string]) => Date.parse(r[1].replace(" ", "T")) - Date.parse(r[0].replace(" ", "T"));
  const raw = [
    { key: "Train", range: model.periods.train, cls: "bg-ink-3/40", note: "Models learn" },
    { key: "Validation", range: model.periods.validation, cls: "bg-expected/60", note: "Choose model & threshold" },
    { key: "Test", range: model.periods.test, cls: "bg-positive/70", note: "Evaluated once" },
  ];
  const total = raw.reduce((a, p) => a + span(p.range), 0);
  const parts = raw.map((p) => ({ ...p, share: Math.round((100 * span(p.range)) / total) }));
  return (
    <figure aria-label="Chronological data split">
      <div className="flex h-2.5 gap-1 overflow-hidden rounded-full">
        {parts.map((p) => (
          <div key={p.key} className={`${p.cls} h-full`} style={{ width: `${p.share}%` }} />
        ))}
      </div>
      <figcaption
        className="mt-4 grid grid-cols-1 gap-4 text-sm sm:gap-3 sm:[grid-template-columns:var(--cols)]"
        style={{ ["--cols" as string]: parts.map((p) => `${p.share}fr`).join(" ") }}
      >
        {parts.map((p) => (
          <div key={p.key} className="min-w-0">
            <p className="text-ink">
              {p.key} <span className="num text-ink-3">· {p.share}%</span>
            </p>
            <p className="num text-xs text-ink-3">
              {fmtShortDate(p.range[0])} – {fmtDate(p.range[1])}
            </p>
            <p className="text-xs text-ink-2">{p.note}</p>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

function Glossary({ term, text }: { term: string; text: string }) {
  return (
    <div className="flex gap-4 rounded-2xl border border-line px-5 py-4">
      <span className="num shrink-0 pt-0.5 text-sm text-ink">{term}</span>
      <p className="text-sm leading-relaxed text-ink-2">{text}</p>
    </div>
  );
}
