"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { IconBolt, IconCheck, IconClock, IconFlask, IconHistory, IconInsights, IconShield, IconSpark } from "@/components/icons";
import { EASE, SPRING, useReduceMotion } from "@/components/motion";
import { Button, PageHeader } from "@/components/ui";
import { site } from "@/lib/data";
import { analyse, inputsFromHistory } from "@/lib/ml/gbm";
import { loadGolden, loadModel } from "@/lib/ml/load";
import { fmtNum } from "@/lib/money";
import { fmtWhen } from "@/lib/time";

const toLocal = (t: string) => t.replace(" ", "T").slice(0, 16);

export default function LearnPage() {
  const reduce = useReduceMotion();
  const m = site.model;
  const ctx = site.context;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Learn"
        title="How WATTWISE thinks"
        sub="The research behind WATTWISE: a model trained on real 10-minute readings that learns normal use and flags what doesn’t fit. The app applies the same idea to your monthly bills, learning your normal from your own history."
      />

      {/* ---------------- Context vs threshold */}
      {ctx?.highButNormal && ctx.lowButUnusual && (
        <section aria-labelledby="ctx-title">
          <h2 id="ctx-title" className="text-2xl font-bold text-ink">
            High consumption is not automatically abnormal.
          </h2>
          <p className="mt-2 max-w-2xl text-ink-2">Two real readings from the held-out test period:</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {[
              { p: ctx.highButNormal, letter: "A", verdict: "Higher use, but expected for that moment", flagged: false },
              { p: ctx.lowButUnusual, letter: "B", verdict: "Lower use, but unusually high for that moment", flagged: true },
            ].map(({ p, letter, verdict, flagged }, i) => {
              const max = Math.max(ctx.highButNormal!.actual, ctx.lowButUnusual!.actual, p.expected);
              return (
                <motion.div
                  key={letter}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ ...SPRING, delay: i * 0.08 }}
                  className={`surface p-6 ${flagged ? "ring-1 ring-amber-bright/40" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <p className="label-caps">Observation {letter}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${flagged ? "bg-amber-soft text-amber" : "bg-sage-soft text-sage-strong"}`}>
                      {flagged ? "Flagged" : "Not flagged"}
                    </span>
                  </div>
                  <p className="num mt-4 text-5xl font-bold text-ink">
                    {fmtNum(p.actual)}
                    <span className="ml-1 text-lg text-ink-3">Wh</span>
                  </p>
                  <p className="num mt-1 text-sm text-blue">{fmtNum(p.expected)} Wh expected</p>
                  <div className="mt-4 space-y-1.5" aria-hidden>
                    <div className="h-2.5 rounded-full bg-sunken">
                      <motion.div
                        className={`h-full origin-left rounded-full ${flagged ? "bg-amber-bright" : "bg-ink"}`}
                        style={{ width: `${(p.actual / max) * 100}%` }}
                        initial={reduce ? false : { scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: EASE }}
                      />
                    </div>
                    <div className="h-2.5 rounded-full bg-sunken">
                      <motion.div
                        className="h-full origin-left rounded-full bg-blue-bright"
                        style={{ width: `${(p.expected / max) * 100}%` }}
                        initial={reduce ? false : { scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}
                      />
                    </div>
                  </div>
                  <p className={`mt-4 font-semibold ${flagged ? "text-amber" : "text-ink"}`}>{verdict}</p>
                  <p className="mt-1 text-xs text-ink-3">{fmtWhen(toLocal(p.t))}</p>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-5 rounded-3xl bg-sage-soft px-6 py-5 text-lg font-semibold text-sage-strong">
            WATTWISE learns context instead of using a fixed threshold.
            {ctx.usageRule && (
              <span className="mt-1 block text-sm font-medium text-ink-2">
                A “flag the {ctx.usageRule.n} highest readings” rule agrees with WATTWISE on only {ctx.usageRule.overlap} of {ctx.usageRule.n} test
                intervals.
              </span>
            )}
          </p>
        </section>
      )}

      {/* ---------------- Pipeline infographic */}
      <section className="surface overflow-hidden p-6 sm:p-8" aria-labelledby="pipe-title">
        <h2 id="pipe-title" className="text-2xl font-bold text-ink">
          From readings to action
        </h2>
        <Pipeline />
        <p className="mt-6 text-sm leading-relaxed text-ink-2">
          The model’s inputs are <strong className="text-ink">three recent-consumption values</strong>: the previous 10-minute reading and the
          averages of the last hour and last 6 hours. WATTWISE uses your saved history and the reading time to assemble those inputs and to
          tailor what it suggests. Time of day, weather and indoor sensors were tested during research but didn’t improve accuracy, so the
          model doesn’t use them.
        </p>
      </section>

      {/* ---------------- Research facts */}
      {m && (
        <section aria-labelledby="eval-title" className="space-y-4">
          <h2 id="eval-title" className="text-2xl font-bold text-ink">
            Does the model work?
          </h2>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="surface p-6">
              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="font-semibold text-ink-3">Selected model</dt>
                  <dd className="mt-0.5 text-lg font-bold text-ink">{m.selected.name}</dd>
                  <dd className="text-ink-2">Chosen by lowest error on a validation period, never on the test data.</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-3">Dataset</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{m.dataset.name}</dd>
                  <dd className="text-ink-2">
                    {fmtNum(m.dataset.rows)} readings · {m.dataset.units} · {m.dataset.license}. Appliance energy of one low-energy house.
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-3">Final test (evaluated once)</dt>
                  <dd className="mt-1 grid grid-cols-2 gap-3">
                    <span className="rounded-2xl bg-sunken px-4 py-3">
                      <span className="block text-xs text-ink-3">Baseline MAE</span>
                      <span className="num text-xl font-bold text-ink">{fmtNum(m.finalTest.baseline.mae, 2)} Wh</span>
                    </span>
                    <span className="rounded-2xl bg-sage-soft px-4 py-3">
                      <span className="block text-xs text-sage-strong">WATTWISE MAE</span>
                      <span className="num text-xl font-bold text-sage-strong">{fmtNum(m.finalTest.model.mae, 2)} Wh</span>
                    </span>
                  </dd>
                  <dd className="mt-3 text-ink-2">
                    <span className="num text-2xl font-bold text-sage-strong">{m.finalTest.improvement.mae}%</span> lower average error and{" "}
                    <span className="num font-bold text-sage-strong">{m.finalTest.improvement.rmse}%</span> lower RMSE than the baseline
                    (RMSE {fmtNum(m.finalTest.baseline.rmse, 2)} → {fmtNum(m.finalTest.model.rmse, 2)} Wh).
                  </dd>
                </div>
              </dl>
            </div>
            <div className="surface p-6">
              <h3 className="font-bold text-ink">Validation comparison (average error, lower is better)</h3>
              <ul className="mt-5 space-y-4">
                {m.validation.map((v, i) => {
                  const max = Math.max(...m.validation.map((x) => x.mae));
                  return (
                    <li key={v.name}>
                      <div className="flex justify-between text-sm">
                        <span className={v.selected ? "font-bold text-ink" : "text-ink-2"}>
                          {v.name}
                          {v.selected && <span className="ml-2 rounded-full bg-sage-soft px-2 py-0.5 text-[11px] font-semibold text-sage-strong">Selected</span>}
                        </span>
                        <span className="num font-semibold text-ink">{fmtNum(v.mae, 2)} Wh</span>
                      </div>
                      <div className="mt-1.5 h-2.5 rounded-full bg-sunken">
                        <motion.div
                          className={`h-full origin-left rounded-full ${v.selected ? "bg-sage" : v.name === "Baseline" ? "bg-ink-3" : "bg-blue-bright"}`}
                          style={{ width: `${(v.mae / max) * 100}%` }}
                          initial={reduce ? false : { scaleX: 0 }}
                          whileInView={{ scaleX: 1 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.7, ease: EASE, delay: i * 0.08 }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {m.persistence && (
                <p className="mt-6 rounded-2xl bg-amber-soft px-4 py-3 text-sm leading-relaxed text-amber">
                  Honest context: simply copying the previous reading scores MAE {fmtNum(m.persistence.test.mae, 2)} Wh on the test period, close to
                  the model’s {fmtNum(m.finalTest.model.mae, 2)}. The model’s clearer gain is on large misses (RMSE {fmtNum(m.finalTest.model.rmse, 2)}{" "}
                  vs {fmtNum(m.persistence.test.rmse, 2)}).
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ---------------- Failures */}
      {site.failures?.length ? (
        <section aria-labelledby="fail-title">
          <h2 id="fail-title" className="text-2xl font-bold text-ink">
            AI isn’t perfect.
          </h2>
          <p className="mt-2 max-w-2xl text-ink-2">Three real errors from the held-out test period, among the model’s largest misses.</p>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {site.failures.map((f, i) => {
              const max = Math.max(f.actual, f.expected);
              return (
                <motion.li
                  key={f.t}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ ...SPRING, delay: i * 0.07 }}
                  className="surface p-5"
                >
                  <p className="text-xs font-semibold text-ink-3">{fmtWhen(toLocal(f.t))}</p>
                  <div className="mt-4 flex items-end gap-4" aria-hidden>
                    {[
                      { label: "Predicted", v: f.expected, cls: "bg-blue-bright" },
                      { label: "Actual", v: f.actual, cls: "bg-ink" },
                    ].map((b) => (
                      <div key={b.label} className="flex flex-1 flex-col items-center">
                        <div className="flex h-28 w-full items-end justify-center">
                          <motion.div
                            className={`w-10 origin-bottom rounded-t-lg ${b.cls}`}
                            style={{ height: `${(b.v / max) * 100}%` }}
                            initial={reduce ? false : { scaleY: 0 }}
                            whileInView={{ scaleY: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.7, ease: EASE }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <dt className="text-xs text-ink-3">Predicted</dt>
                      <dd className="num font-bold text-blue">{fmtNum(f.expected)} Wh</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-3">Actual</dt>
                      <dd className="num font-bold text-ink">{fmtNum(f.actual)} Wh</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-ink-3">Error</dt>
                      <dd className="num font-bold text-ink">{fmtNum(f.absError)} Wh</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm leading-relaxed text-ink-2">
                    {f.error > 0 ? "Used far more than expected." : "Used far less than expected: the model expected high use to continue."}
                    {f.previousInterval !== null && ` The reading just before was ${fmtNum(f.previousInterval)} Wh.`}
                  </p>
                </motion.li>
              );
            })}
          </ul>
          <div className="mt-4 rounded-3xl border border-line bg-sunken/60 p-6">
            <h3 className="font-bold text-ink">What WATTWISE couldn’t see</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {["Occupancy", "Maintenance", "Specific appliances", "Unusual events"].map((x) => (
                <li key={x} className="rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink-2">
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-ink-3">Any of these could matter. We never claim they were the actual reason for a specific error.</p>
          </div>
        </section>
      ) : null}

      <GoldenPanel />

      <section className="flex gap-4 rounded-3xl bg-sage-soft/70 p-6" aria-labelledby="privacy-title">
        <IconShield size={26} className="shrink-0 text-sage-strong" />
        <div>
          <h2 id="privacy-title" className="font-bold text-ink">
            Privacy
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">
            Your analysis stays in this browser. This prototype uses local storage. No energy data is sent to a generative AI API: the model is a
            file served with this app, and every prediction is computed on your device.
          </p>
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- pipeline infographic */
function Pipeline() {
  const reduce = useReduceMotion();
  const inputs = [
    { label: "History", sub: "your saved readings", Icon: IconHistory },
    { label: "Time", sub: "when the reading happened", Icon: IconClock },
    { label: "Recent consumption", sub: "the model’s 3 inputs", Icon: IconInsights },
  ];
  const chain = [
    { label: "Machine learning", sub: site.model ? `${site.model.selected.name}, trained on real readings` : "trained model", tone: "bg-ink text-white" },
    { label: "Expected consumption", sub: "what normal looks like now", tone: "bg-blue-soft text-blue" },
    { label: "Compare with actual", sub: "the real meter reading", tone: "bg-surface text-ink border border-line" },
    { label: "Residual", sub: "actual − expected", tone: "bg-surface text-ink border border-line" },
    { label: "Unusual usage detection", sub: "top 5% of validation surprises", tone: "bg-amber-soft text-amber" },
    { label: "Action", sub: "what’s worth checking", tone: "bg-sage-soft text-sage-strong" },
  ];
  const fade = (i: number) =>
    reduce
      ? {}
      : { initial: { opacity: 0, y: 12 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.4 }, transition: { ...SPRING, delay: i * 0.12 } };
  return (
    <div className="mt-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {inputs.map(({ label, sub, Icon }, i) => (
          <motion.div key={label} {...fade(i)} className="flex items-center gap-3 rounded-2xl bg-sunken px-4 py-3">
            <span className="grid size-10 place-items-center rounded-xl bg-surface text-ink-2">
              <Icon size={20} />
            </span>
            <span>
              <span className="block font-bold text-ink">{label}</span>
              <span className="block text-xs text-ink-3">{sub}</span>
            </span>
          </motion.div>
        ))}
      </div>
      {/* converging connectors */}
      <svg aria-hidden viewBox="0 0 300 40" preserveAspectRatio="none" className="h-10 w-full">
        {[50, 150, 250].map((x0, i) => (
          <g key={x0}>
            <motion.path
              d={`M${x0} 0 C ${x0} 22, 150 18, 150 40`}
              fill="none"
              stroke="var(--color-line-strong)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              initial={reduce ? false : { opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.1 }}
            />
            <path
              d={`M${x0} 0 C ${x0} 22, 150 18, 150 40`}
              fill="none"
              stroke="var(--color-sage-bright)"
              strokeWidth="1.5"
              strokeDasharray="3 7"
              vectorEffect="non-scaling-stroke"
              className="flow-dash"
            />
          </g>
        ))}
      </svg>
      <ol className="mx-auto flex max-w-md flex-col items-stretch">
        {chain.map((c, i) => (
          <li key={c.label} className="flex flex-col items-center">
            {i > 0 && (
              <svg aria-hidden width="12" height="26" viewBox="0 0 12 26">
                <path d="M6 1 V25" stroke="var(--color-line-strong)" strokeWidth="2" />
                <path d="M6 1 V25" stroke="var(--color-sage-bright)" strokeWidth="2" strokeDasharray="3 7" className="flow-dash" />
              </svg>
            )}
            <motion.div {...fade(i + 3)} className={`w-full rounded-2xl px-5 py-3 text-center ${c.tone}`}>
              <p className="font-bold">{c.label}</p>
              <p className="text-xs opacity-85">{c.sub}</p>
            </motion.div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------------------------------------------------------- golden tests in the browser */
type Row = { t: string; python: number; browser: number; diff: number; pctOk: boolean; flagOk: boolean };

function GoldenPanel() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);
  const [tol, setTol] = useState(1e-6);

  const run = async () => {
    setRunning(true);
    const [model, golden] = await Promise.all([loadModel(), loadGolden()]);
    setTol(golden.tolerance.expectedWh);
    const out: Row[] = golden.cases.map((c) => {
      const inputs = inputsFromHistory(c.history, model.historyIntervals)!;
      const r = analyse(model, c.actualWh, inputs);
      return {
        t: c.timestamp,
        python: c.pythonExpectedWh,
        browser: r.expectedWh,
        diff: Math.abs(r.expectedWh - c.pythonExpectedWh),
        pctOk: Math.abs(r.percentile - c.pythonPercentile) < 1e-9,
        flagOk: r.flagged === c.pythonFlagged,
      };
    });
    setRows(out);
    setRunning(false);
  };
  const passed = rows?.filter((r) => r.diff <= tol && r.pctOk && r.flagOk).length ?? 0;

  return (
    <section className="surface p-6 sm:p-8" aria-labelledby="golden-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h2 id="golden-title" className="flex items-center gap-2 text-2xl font-bold text-ink">
            <IconFlask size={22} className="text-blue" /> Model verification
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Runs real held-out test cases through this browser’s model and compares each prediction with the Python model’s output. Each
            case starts from 36 raw readings, so the feature calculation is tested too.
          </p>
        </div>
        <Button onClick={run} disabled={running} variant={rows ? "secondary" : "primary"}>
          <IconBolt size={18} /> {running ? "Running…" : rows ? "Run again" : "Run golden tests"}
        </Button>
      </div>
      {rows && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <p className={`flex items-center gap-2 font-semibold ${passed === rows.length ? "text-sage-strong" : "text-danger"}`} role="status">
            {passed === rows.length ? <IconCheck size={18} /> : <IconSpark size={18} />} {passed} of {rows.length} cases match Python
            (tolerance {tol} Wh)
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-sunken text-left text-xs text-ink-3">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Reading</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Python (Wh)</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Browser (Wh)</th>
                  <th className="px-4 py-2.5 text-right font-semibold">|Difference|</th>
                  <th className="px-4 py-2.5 font-semibold">Result</th>
                </tr>
              </thead>
              <tbody className="num divide-y divide-line">
                {rows.map((r) => {
                  const ok = r.diff <= tol && r.pctOk && r.flagOk;
                  return (
                    <tr key={r.t}>
                      <td className="px-4 py-2 text-ink-2">{fmtWhen(r.t)}</td>
                      <td className="px-4 py-2 text-right text-ink">{r.python.toFixed(6)}</td>
                      <td className="px-4 py-2 text-right text-ink">{r.browser.toFixed(6)}</td>
                      <td className="px-4 py-2 text-right text-ink-2">{r.diff.toExponential(1)}</td>
                      <td className={`px-4 py-2 font-semibold ${ok ? "text-sage-strong" : "text-danger"}`}>{ok ? "Match" : "Mismatch"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-ink-3">Anomaly percentiles and unusual/normal flags were compared for every case too.</p>
        </motion.div>
      )}
    </section>
  );
}
