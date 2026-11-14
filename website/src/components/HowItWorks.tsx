import type { Anomaly, ModelData } from "@/lib/types";
import { featureLabel, fmtNum } from "@/lib/format";
import { Reveal } from "./motion";
import { Section, SectionHeader, Unavailable } from "./ui";

const GROUPS: { title: string; members: string[] }[] = [
  { title: "Recent consumption", members: ["previous_interval", "previous_hour", "rolling_1h_mean", "rolling_6h_mean"] },
  { title: "Historical electricity use", members: ["previous_day_same_time", "rolling_24h_mean"] },
  { title: "Time patterns", members: ["hour", "hour_cyclic", "day_of_week", "day_of_week_cyclic", "is_weekend"] },
  {
    title: "Environmental & other sensors",
    members: ["outdoor_weather_previous_interval", "indoor_conditions_previous_interval", "lights_previous_interval"],
  },
];

export function HowItWorks({ model, hero }: { model: ModelData | null; hero: Anomaly | null }) {
  if (!model) {
    return (
      <Section id="how" labelledBy="how-title" className="border-t border-line">
        <SectionHeader id="how-title" eyebrow="How it works" title="How WATTWISE AI works" />
        <Unavailable what="The model description" />
      </Section>
    );
  }
  const kept = new Set(model.candidateFeatures?.kept ?? model.selected.features);
  const all = model.candidateFeatures?.all ?? [];
  const others = model.validation.filter((v) => v.name !== "Baseline" && !v.selected).map((v) => v.name);

  const steps = [
    {
      title: "Machine-learning model",
      body: (
        <>
          <span className="text-ink">{model.selected.name}</span>, chosen on validation data over {others.join(" and ")}.
        </>
      ),
    },
    { title: "Expected consumption", body: "Its prediction of normal use for the next 10 minutes, made before the reading arrives." },
    { title: "Actual vs expected", body: "When the real reading arrives, WATTWISE measures the gap between the two: the residual." },
    {
      title: "Anomaly detection",
      body: (
        <>
          A residual of at least <span className="num text-unexpected">{fmtNum(model.anomalyMethod.thresholdWh)} Wh</span> is
          flagged. That threshold is the top 5% of positive residuals measured on validation data, set before the test period.
        </>
      ),
    },
  ];

  return (
    <Section id="how" labelledBy="how-title" className="border-t border-line">
      <SectionHeader
        id="how-title"
        eyebrow="How it works"
        title="It learns what normal looks like, then measures the surprise."
        lede="WATTWISE predicts how much energy should be used in the next 10 minutes. Then it compares that prediction with what the meter actually records."
      />

      <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
        {/* Formula: sticky on desktop */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <Reveal className="panel p-7 sm:p-9">
            <p className="eyebrow">The one idea to remember</p>
            <p className="mt-6 text-2xl font-medium leading-snug tracking-tight sm:text-3xl">
              <span className="whitespace-nowrap">
                Residual <span className="text-ink-3">=</span> <span className="text-actual">Actual</span>
              </span>{" "}
              <span className="whitespace-nowrap">
                <span className="text-ink-3">−</span> <span className="text-expected">AI prediction</span>
              </span>
            </p>
            {hero && (
              <p className="num mt-6 rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-lg text-ink-2">
                {fmtNum(hero.actual)} <span className="text-ink-3">−</span> {fmtNum(hero.expected)}{" "}
                <span className="text-ink-3">=</span> <span className="text-unexpected">+{fmtNum(hero.residual)} Wh</span>
              </p>
            )}
            <ul className="mt-7 space-y-3 text-[0.95rem] leading-relaxed text-ink-2">
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-ink-3" />
                Close to zero: the building behaved as expected.
              </li>
              <li className="flex gap-3">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-unexpected" />
                Large and positive: much more energy than expected, so the period is worth investigating.
              </li>
            </ul>
          </Reveal>
        </div>

        {/* Pipeline */}
        <ol className="relative space-y-5" aria-label="WATTWISE pipeline">
          <span aria-hidden className="absolute bottom-8 left-[1.15rem] top-8 w-px bg-gradient-to-b from-line-strong via-line-strong to-unexpected/50" />

          <Reveal as="li" className="relative pl-12">
            <StepDot n={1} />
            <div className="panel p-6">
              <h3 className="font-medium text-ink">What the model can look at</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
                {all.length || "Several"} candidate inputs were tested. Only those that improved validation accuracy were kept:{" "}
                <span className="text-ink">{kept.size} of {all.length || kept.size}</span>.
              </p>
              <div className="mt-5 space-y-4">
                {GROUPS.map((g) => {
                  const members = g.members.filter((m) => all.length === 0 || all.includes(m));
                  if (!members.length) return null;
                  return (
                    <div key={g.title}>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-3">{g.title}</p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {members.map((m) => {
                          const isKept = kept.has(m);
                          return (
                            <li
                              key={m}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                                isKept ? "border-expected/40 bg-expected/10 text-ink" : "border-line text-ink-3"
                              }`}
                            >
                              {isKept ? (
                                <svg aria-hidden viewBox="0 0 12 12" className="size-3 text-expected">
                                  <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : null}
                              {featureLabel(m)}
                              <span className="sr-only">{isKept ? " (kept)" : " (tested, not kept)"}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5 text-xs leading-relaxed text-ink-3">
                Every input uses only information from before the prediction.
                {model.leakageCheckPassed ? " An automatic leakage check confirmed this." : ""}
              </p>
            </div>
          </Reveal>

          {steps.map((s, i) => (
            <Reveal as="li" key={s.title} className="relative pl-12" delay={0.05 * (i + 1)}>
              <StepDot n={i + 2} accent={i === steps.length - 1} />
              <div className="panel p-6">
                <h3 className="font-medium text-ink">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </Section>
  );
}

function StepDot({ n, accent = false }: { n: number; accent?: boolean }) {
  return (
    <span
      aria-hidden
      className={`num absolute left-0 top-5 grid size-[2.3rem] place-items-center rounded-full border bg-bg text-sm ${
        accent ? "border-unexpected/60 text-unexpected" : "border-line-strong text-ink-2"
      }`}
    >
      {n}
    </span>
  );
}
