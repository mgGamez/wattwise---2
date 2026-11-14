import type { ContextPoint, Failure, ModelData, SiteData } from "@/lib/types";
import { featureLabel, fmtDate, fmtNum, fmtSigned, fmtTimestamp } from "@/lib/format";
import { Reveal } from "./motion";
import { MiniChart } from "./MiniChart";
import { Section, SectionHeader, Unavailable } from "./ui";
import { Mark } from "./Nav";

/* ------------------------------------------------------------------ CONTEXT MATTERS */
export function ContextMatters({ context }: { context: SiteData["context"] }) {
  return (
    <Section id="context" labelledBy="context-title" className="border-t border-line">
      <SectionHeader
        id="context-title"
        eyebrow="Context matters"
        title={
          <>
            WATTWISE doesn’t ask whether consumption is high.{" "}
            <span className="text-ink-2">It asks whether it’s unusual for that moment.</span>
          </>
        }
        lede="A fixed “too high” threshold would rank these two real readings the wrong way round."
      />
      {!context?.highButNormal || !context.lowButUnusual ? (
        <Unavailable what="The context comparison" />
      ) : (
        <>
          <div className="mt-14 grid gap-4 md:grid-cols-2">
            <ObservationCard letter="A" p={context.highButNormal} verdict="Higher use, but normal for that moment" flagged={false} />
            <ObservationCard letter="B" p={context.lowButUnusual} verdict="Lower use, but unusual for that moment" flagged delay={0.08} />
          </div>

          <Reveal className="panel mt-4 p-6 sm:p-8">
            <p className="eyebrow">Simple rule vs WATTWISE</p>
            <p className="mt-3 max-w-3xl text-lg leading-relaxed text-ink-2">
              Flag the <span className="text-ink">{context.usageRule.n} highest-usage</span> test intervals, the same number
              WATTWISE flagged, and the two lists agree on only{" "}
              <span className="num text-ink">{context.usageRule.overlap}</span>.
            </p>
            <dl className="mt-8 grid gap-6 sm:grid-cols-3">
              <Overlap n={context.usageRule.overlap} label="Flagged by both" tone="text-ink" />
              <Overlap
                n={context.usageRule.n - context.usageRule.overlap}
                label="Only WATTWISE: unusual for the moment, though not the highest use"
                tone="text-unexpected"
              />
              <Overlap
                n={context.usageRule.n - context.usageRule.overlap}
                label="Only the usage rule: high, but within what the model expected"
                tone="text-ink-2"
              />
            </dl>
          </Reveal>
        </>
      )}
    </Section>
  );
}

function ObservationCard({
  letter,
  p,
  verdict,
  flagged,
  delay = 0,
}: {
  letter: string;
  p: ContextPoint;
  verdict: string;
  flagged: boolean;
  delay?: number;
}) {
  return (
    <Reveal delay={delay} className={`panel p-6 sm:p-8 ${flagged ? "ring-1 ring-unexpected/25" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Observation {letter}</p>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${
            flagged ? "border-unexpected/40 bg-unexpected/10 text-unexpected" : "border-line text-ink-2"
          }`}
        >
          {flagged ? "Flagged" : "Not flagged"}
        </span>
      </div>
      <p className="num mt-6 text-5xl font-medium text-ink sm:text-6xl">
        {fmtNum(p.actual)}
        <span className="ml-1.5 text-xl text-ink-3">Wh</span>
      </p>
      <p className="num mt-2 text-sm text-ink-2">
        <span className="text-expected">{fmtNum(p.expected)} Wh expected</span> · {fmtSigned(p.residual)} Wh (
        {fmtSigned(p.pctAbove)}%)
      </p>
      <p className={`mt-5 font-medium ${flagged ? "text-unexpected" : "text-ink"}`}>{verdict}</p>
      <p className="num mt-1 text-xs text-ink-3">{fmtTimestamp(p.t)}</p>
      <div className="mt-6">
        <MiniChart
          points={p.context}
          focus={p.t}
          height={120}
          focusTone={flagged ? "unexpected" : "expected"}
          label={`Observation ${letter}: ${fmtNum(p.actual)} Wh actual versus ${fmtNum(p.expected)} Wh expected at ${fmtTimestamp(p.t)}.`}
        />
      </div>
    </Reveal>
  );
}

function Overlap({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="flex flex-col-reverse justify-end border-t border-line pt-4">
      <dt className="mt-2 text-sm leading-relaxed text-ink-2">{label}</dt>
      <dd className={`num text-4xl font-medium ${tone}`}>{n}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ FAILURE LAB */
export function FailureLab({ failures }: { failures: Failure[] | null }) {
  return (
    <Section id="failures" labelledBy="failures-title" className="border-t border-line">
      <SectionHeader
        id="failures-title"
        eyebrow="Failure lab"
        title="AI gets things wrong."
        lede="These are real errors from the test period, among the model’s largest misses in each direction. Showing them is part of the evidence."
      />
      {!failures?.length ? (
        <Unavailable what="The failure analysis" />
      ) : (
        <>
          <ul className="mt-14 grid gap-4 lg:grid-cols-3">
            {failures.map((f, i) => (
              <FailureCard key={f.t} f={f} delay={i * 0.06} />
            ))}
          </ul>
          <Reveal className="panel mt-4 grid gap-6 p-6 sm:p-8 md:grid-cols-[16rem_1fr]">
            <div>
              <p className="eyebrow">What the model can’t observe</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-2">
                It only sees recent meter readings. We don’t claim any of these caused a specific error.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {["Occupancy: who is home", "Appliance-level activity: what was switched on", "Maintenance or faults", "Unusual human behaviour"].map(
                (item) => (
                  <li key={item} className="flex items-start gap-3 rounded-xl border border-line px-4 py-3 text-sm text-ink-2">
                    <svg aria-hidden viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-ink-3">
                      <path d="M2 8s2.5-4.5 6-4.5S14 8 14 8s-2.5 4.5-6 4.5S2 8 2 8Z M3 13 13 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    {item}
                  </li>
                ),
              )}
            </ul>
          </Reveal>
        </>
      )}
    </Section>
  );
}

function FailureCard({ f, delay }: { f: Failure; delay: number }) {
  const under = f.error > 0;
  return (
    <Reveal as="li" delay={delay} className="panel flex flex-col p-6">
      <p className="eyebrow">{under ? "Missed a sudden jump" : "Expected high use to continue"}</p>
      <p className="num mt-2 text-xs text-ink-3">{fmtTimestamp(f.t)}</p>
      <dl className="mt-6 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-ink-3">Prediction</dt>
          <dd className="num mt-1 text-xl text-expected">{fmtNum(f.expected)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Actual</dt>
          <dd className="num mt-1 text-xl text-ink">{fmtNum(f.actual)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Abs. error</dt>
          <dd className="num mt-1 text-xl text-ink">{fmtNum(f.absError)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-right text-[11px] text-ink-3">Wh per 10 min</p>
      <div className="mt-4">
        <MiniChart
          points={f.context}
          focus={f.t}
          height={110}
          focusTone={under ? "unexpected" : "expected"}
          label={`Model error at ${fmtTimestamp(f.t)}: predicted ${fmtNum(f.expected)} Wh, actual ${fmtNum(f.actual)} Wh.`}
        />
      </div>
      <p className="mt-5 text-sm leading-relaxed text-ink-2">
        {f.previousInterval !== null && (
          <>
            The reading just before was <span className="num text-ink">{fmtNum(f.previousInterval)} Wh</span>.{" "}
          </>
        )}
        {under
          ? `The model expected ${fmtNum(f.expected)} Wh; the meter recorded ${fmtNum(f.actual)} Wh.`
          : `The model expected high use to continue (${fmtNum(f.expected)} Wh); the meter recorded ${fmtNum(f.actual)} Wh.`}
        {f.flagged && " This interval was also flagged as unexpected: the model can’t tell a one-off switch-on from a problem."}
      </p>
    </Reveal>
  );
}

/* ------------------------------------------------------------------ WHAT THE MODEL LEARNED */
export function Learned({ model }: { model: ModelData | null }) {
  const fi = model?.featureImportance;
  if (!model || !fi?.length) return null; // omit when unavailable
  return (
    <Section id="learned" labelledBy="learned-title" className="border-t border-line">
      <SectionHeader
        id="learned-title"
        eyebrow="What the model learned"
        title="Features that influenced prediction"
        lede={`How much the ${model.selected.name} model relied on each of its inputs. This shows what the model used, not what causes energy consumption.`}
      />
      <Reveal className="panel mt-12 p-6 sm:p-8">
        <ul className="space-y-6">
          {fi.map((f) => (
            <li key={f.feature}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-ink">{featureLabel(f.feature)}</span>
                <span className="num text-ink-2">{fmtNum(f.importance * 100, 1)}%</span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.04]">
                <div className="h-full rounded-full bg-expected" style={{ width: `${f.importance * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-8 border-t border-line pt-5 text-sm leading-relaxed text-ink-2">
          The most recent reading dominates: short-term appliance use looks a lot like the last 10 minutes. Time of day, weekday,
          weather and indoor sensors were tested, but they did not improve validation accuracy, so they were left out. Importance
          is the model’s built-in measure: the share of its error reduction that came from each input.
        </p>
      </Reveal>
    </Section>
  );
}

/* ------------------------------------------------------------------ LIMITATIONS */
export function Limitations({ model }: { model: ModelData | null }) {
  const inj = model?.anomalyMethod.injection;
  const items: { title: string; body: string }[] = [
    {
      title: "An anomaly is not proof of waste",
      body: "A flag means use was much higher than expected. It marks a period worth investigating, nothing more.",
    },
    {
      title: "One specific environment",
      body: model
        ? `The data is appliance energy from one low-energy house: ${fmtNum(model.dataset.rows)} readings, ${fmtDate(model.periods.train[0])} – ${fmtDate(model.periods.test[1])}. Results may not transfer to other buildings.`
        : "The data is appliance energy from one low-energy house over a few months. Results may not transfer to other buildings.",
    },
    {
      title: "No appliance-level insight",
      body: "The meter measures total appliance energy. The model cannot identify which appliance caused a spike.",
    },
    {
      title: "Behaviour changes over time",
      body: "Routines and seasons shift. A real deployment would need ongoing monitoring and regular retraining.",
    },
  ];
  if (model?.persistence) {
    items.push({
      title: "Close to a simple rule on average",
      body: `Copying the previous reading reaches MAE ${fmtNum(model.persistence.test.mae, 2)} vs the model’s ${fmtNum(
        model.finalTest.model.mae,
        2,
      )}. The model’s clearer gain is on large misses.`,
    });
  }
  if (inj) {
    items.push({
      title: "Best at large, sudden spikes",
      body: `In a stress test that added +${inj.added_wh_per_interval} Wh for ${inj.event_length_minutes} minutes at ${inj.events} random times, only ${fmtNum(
        inj.injected_intervals_flagged_pct,
        1,
      )}% of those intervals were flagged. Moderate, sustained increases are usually missed.`,
    });
  }
  return (
    <Section id="limits" labelledBy="limits-title" className="border-t border-line">
      <SectionHeader
        id="limits-title"
        eyebrow="Limitations"
        title="What WATTWISE can’t do, yet."
        lede="Being clear about the limits is what makes the results trustworthy."
      />
      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <Reveal as="li" key={it.title} delay={(i % 3) * 0.05} className="panel p-6">
            <h3 className="font-medium text-ink">{it.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">{it.body}</p>
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------------ CLOSING + FOOTER */
export function Closing({ model, generatedAt }: { model: ModelData | null; generatedAt: string }) {
  return (
    <>
      <section aria-labelledby="closing-title" className="relative overflow-hidden border-t border-line py-32 sm:py-44">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(50% 60% at 50% 100%, rgb(122 167 255 / 0.10), transparent 70%)" }}
        />
        <div className="container-page relative text-center">
          <Reveal>
            <h2 id="closing-title" className="text-5xl font-semibold tracking-[-0.045em] sm:text-7xl">
              See energy differently.
            </h2>
            <p className="mt-8 inline-flex items-center gap-2.5 text-sm font-semibold tracking-[0.2em] text-ink">
              <Mark /> WATTWISE
            </p>
            <p className="mt-3 text-lg text-ink-2">AI-powered energy intelligence for buildings.</p>
            <a
              href="#top"
              className="mt-10 inline-flex h-12 items-center rounded-full border border-line-strong px-6 text-sm text-ink transition-colors hover:bg-white/[0.04]"
            >
              Back to top
            </a>
          </Reveal>
        </div>
      </section>
      <footer className="border-t border-line py-10 text-sm text-ink-3">
        <div className="container-page flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-2 leading-relaxed">
            <p>
              Veritas AI International High School Hackathon 2026 · Track: AI + Climate. Built with scikit-learn, no paid AI APIs.
            </p>
            <p>
              Data: {model?.dataset.name ?? "UCI Appliances Energy Prediction"}, {model?.dataset.license ?? "CC BY 4.0"}. Every
              number on this page is read from the WATTWISE ML pipeline outputs (generated{" "}
              <span className="num">{generatedAt.slice(0, 10)}</span>).
            </p>
          </div>
          <a
            href="https://github.com/mgGamez/wattwise---2"
            className="shrink-0 text-ink-2 underline-offset-4 hover:text-ink hover:underline"
            rel="noopener noreferrer"
          >
            Source on GitHub
          </a>
        </div>
      </footer>
    </>
  );
}
