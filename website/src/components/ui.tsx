import type { ReactNode } from "react";
import { Reveal } from "./motion";

export function SectionHeader({
  eyebrow,
  title,
  lede,
  id,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  id?: string;
}) {
  return (
    <Reveal as="header" className="max-w-3xl">
      <p className="eyebrow">{eyebrow}</p>
      <h2 id={id} className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-[2.75rem] sm:leading-[1.08]">
        {title}
      </h2>
      {lede && <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-2 sm:text-lg">{lede}</p>}
    </Reveal>
  );
}

export function Section({
  id,
  labelledBy,
  children,
  className = "",
}: {
  id: string;
  labelledBy: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={`relative py-24 sm:py-32 ${className}`}>
      <div className="container-page">{children}</div>
    </section>
  );
}

/** Shown when a results file is missing at build time. */
export function Unavailable({ what }: { what: string }) {
  return (
    <div role="status" className="panel mt-10 p-6 text-sm leading-relaxed text-ink-2">
      <p className="font-medium text-ink">{what} is unavailable.</p>
      <p className="mt-1">
        The ML output it depends on was not found at build time. Run <code className="num text-ink">python ml/train.py</code>, then rebuild
        the website.
      </p>
    </div>
  );
}

/** Small legend key: a line sample + label. */
export function LegendKey({ kind, label }: { kind: "actual" | "expected" | "unexpected"; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-2">
      {kind === "actual" && <span aria-hidden className="h-[2px] w-5 rounded bg-actual" />}
      {kind === "expected" && (
        <span aria-hidden className="h-0 w-5 border-t-2 border-dashed border-expected" />
      )}
      {kind === "unexpected" && (
        <span aria-hidden className="size-3 rounded-full border-2 border-unexpected bg-unexpected/25" />
      )}
      {label}
    </span>
  );
}

export function Stat({
  label,
  children,
  tone = "ink",
  hint,
}: {
  label: string;
  children: ReactNode;
  tone?: "ink" | "expected" | "unexpected" | "positive";
  hint?: ReactNode;
}) {
  const color = { ink: "text-ink", expected: "text-expected", unexpected: "text-unexpected", positive: "text-positive" }[tone];
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className={`num mt-2 text-3xl font-medium sm:text-4xl ${color}`}>{children}</dd>
      {hint && <dd className="mt-1 text-sm text-ink-3">{hint}</dd>}
    </div>
  );
}
