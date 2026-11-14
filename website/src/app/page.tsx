import { site } from "@/lib/data";
import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { FeaturedAnomaly, Problem } from "@/components/Story";
import { HowItWorks } from "@/components/HowItWorks";
import { Evaluation } from "@/components/Evaluation";
import { ActualVsExpected } from "@/components/ActualVsExpected";
import { AnomalyExplorer } from "@/components/AnomalyExplorer";
import { Closing, ContextMatters, FailureLab, Learned, Limitations } from "@/components/Insights";

// Page order follows the judge journey:
// problem (10s) → real result (30s) → how it works (60s) → evidence (90s) → failures & limits (<2 min).
export default function Home() {
  const { model, hero } = site;
  return (
    <>
      <Nav />
      <main id="main">
        <Hero line={site.heroLine} focusActual={hero?.actual ?? null} />
        <Problem hero={hero} />
        <FeaturedAnomaly hero={hero} model={model} />
        <HowItWorks model={model} hero={hero} />
        <Evaluation model={model} />
        <ActualVsExpected chart={site.chart} threshold={model?.anomalyMethod.thresholdWh ?? null} />
        <AnomalyExplorer anomalies={site.anomalies} />
        <ContextMatters context={site.context} />
        <FailureLab failures={site.failures} />
        <Learned model={model} />
        <Limitations model={model} />
      </main>
      <Closing model={model} generatedAt={site.generatedAt} />
    </>
  );
}
