import type { Anomaly, ModelData } from "@/lib/types";
import { fmtNum, fmtPercentile, fmtSigned, fmtTimestamp } from "@/lib/format";
import { CountUp, Reveal } from "./motion";
import { MiniChart } from "./MiniChart";
import { LegendKey, Section, SectionHeader, Unavailable } from "./ui";

/* ------------------------------------------------------------------ THE PROBLEM */
export function Problem({ hero }: { hero: Anomaly | null }) {
  return (
    <Section id="problem" labelledBy="problem-title">
      <SectionHeader
        id="problem-title"
        eyebrow="The problem"
        title="Knowing how much energy you used isn’t enough."
        lede={
          <>
            Traditional energy dashboards show consumption. WATTWISE asks a better question:{" "}
            <span className="text-ink">“Was this amount normal for this building at this moment?”</span>
          </>
        }
      />
      {hero ? (
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          <Reveal className="panel p-7 sm:p-9">
            <p className="eyebrow">A typical dashboard</p>
            <p className="num mt-8 text-6xl font-medium tracking-tight text-ink-2 sm:text-7xl">
              {fmtNum(hero.actual)}
              <span className="ml-2 text-2xl text-ink-3">Wh</span>
            </p>
            <p className="mt-3 text-sm text-ink-3">{fmtTimestamp(hero.t)}</p>
            <p className="mt-8 border-t border-line pt-5 text-ink-2">Is that a lot? The number alone can’t tell you.</p>
          </Reveal>
          <Reveal delay={0.1} className="panel relative overflow-hidden p-7 sm:p-9">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-unexpected/10 blur-3xl" />
            <p className="eyebrow">WATTWISE</p>
            <div className="mt-8 flex flex-wrap items-end gap-x-6 gap-y-3">
              <p className="num text-6xl font-medium tracking-tight text-ink sm:text-7xl">
                {fmtNum(hero.actual)}
                <span className="ml-2 text-2xl text-ink-3">Wh used</span>
              </p>
            </div>
            <p className="num mt-3 text-lg text-expected">{fmtNum(hero.expected)} Wh expected for this moment</p>
            <p className="mt-8 flex items-center gap-3 border-t border-line pt-5 text-ink">
              <span className="inline-flex items-center gap-2 rounded-full border border-unexpected/40 bg-unexpected/10 px-3 py-1 text-sm text-unexpected">
                <span aria-hidden className="size-1.5 rounded-full bg-unexpected" />
                Unexpected consumption
              </span>
              <span className="text-ink-2">worth a closer look</span>
            </p>
          </Reveal>
        </div>
      ) : (
        <Unavailable what="The example anomaly" />
      )}
    </Section>
  );
}

/* ------------------------------------------------------------------ FEATURED REAL ANOMALY */
export function FeaturedAnomaly({ hero, model }: { hero: Anomaly | null; model: ModelData | null }) {
  return (
    <Section id="anomaly" labelledBy="anomaly-title" className="border-t border-line">
      <SectionHeader
        id="anomaly-title"
        eyebrow="A real result · final test period"
        title="Unexpected consumption"
        lede={
          hero ? (
            <>
              The largest gap between actual and expected use on data the model never saw.
              Measured in <span className="text-ink">Wh per 10-minute interval</span>.
            </>
          ) : undefined
        }
      />
      {!hero ? (
        <Unavailable what="The featured anomaly" />
      ) : (
        <div className="mt-14 grid gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <Reveal>
            <p className="num text-sm text-ink-2">{fmtTimestamp(hero.t)}</p>
            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-9">
              <div>
                <dt className="eyebrow">Actual</dt>
                <dd className="num mt-2 text-5xl font-medium text-ink sm:text-6xl">
                  <CountUp value={hero.actual} />
                  <span className="ml-1.5 text-xl text-ink-3">Wh</span>
                </dd>
              </div>
              <div>
                <dt className="eyebrow">AI expected</dt>
                <dd className="num mt-2 text-5xl font-medium text-expected sm:text-6xl">
                  <CountUp value={hero.expected} />
                  <span className="ml-1.5 text-xl text-ink-3">Wh</span>
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Difference</dt>
                <dd className="num mt-2 text-3xl font-medium text-unexpected sm:text-4xl">
                  <CountUp value={hero.residual} prefix="+" />
                  <span className="ml-1.5 text-base text-ink-3">Wh</span>
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Above expected</dt>
                <dd className="num mt-2 text-3xl font-medium text-unexpected sm:text-4xl">
                  <CountUp value={hero.pctAbove} prefix="+" suffix="%" />
                </dd>
              </div>
              <div className="col-span-2 border-t border-line pt-6">
                <dt className="eyebrow">Anomaly percentile</dt>
                <dd className="mt-2 flex flex-wrap items-baseline gap-x-3">
                  <span className="num text-3xl font-medium text-ink sm:text-4xl">{fmtPercentile(hero.percentile)}</span>
                  <span className="text-sm text-ink-2">
                    larger than {fmtNum(hero.percentile, 1)}% of the positive surprises seen during validation
                  </span>
                </dd>
              </div>
            </dl>
          </Reveal>

          <Reveal delay={0.1} className="panel p-5 sm:p-7">
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <LegendKey kind="actual" label="Actual" />
              <LegendKey kind="expected" label="AI expected" />
              <LegendKey kind="unexpected" label="Flagged interval" />
            </div>
            <div className="mt-6">
              <MiniChart
                points={hero.context}
                focus={hero.t}
                height={240}
                label={`Actual versus expected consumption for three hours either side of ${fmtTimestamp(hero.t)}. At the flagged interval, actual use was ${fmtNum(hero.actual)} Wh against ${fmtNum(hero.expected)} Wh expected.`}
              />
            </div>
            <p className="mt-6 text-sm leading-relaxed text-ink-2">
              Flagged because the difference ({fmtSigned(hero.residual)} Wh) is above the detection threshold of{" "}
              <span className="num text-ink">{model ? fmtNum(model.anomalyMethod.thresholdWh) : "—"} Wh</span>. This is a
              period requiring investigation, <span className="text-ink">not proof of waste</span>: the model cannot see what
              was switched on.
            </p>
          </Reveal>
        </div>
      )}
    </Section>
  );
}
