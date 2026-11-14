"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { EASE } from "./motion";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/90 shadow-[0_6px_20px_-8px_rgb(29_32_36/0.5)]",
  secondary: "bg-surface text-ink border border-line-strong hover:border-ink-3 hover:bg-white",
  ghost: "text-ink-2 hover:text-ink hover:bg-sunken",
  danger: "bg-danger text-white hover:bg-danger/90",
  quiet: "bg-sunken text-ink hover:bg-line",
};

const SIZES = { md: "h-11 px-5 text-[0.95rem]", lg: "h-14 px-7 text-base", sm: "h-9 px-3.5 text-sm" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof SIZES = "md", extra = "") {
  return `tap inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-full font-semibold transition-[background,box-shadow,transform,border-color,color] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof SIZES }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...rest} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  size?: keyof typeof SIZES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function PageHeader({ eyebrow, title, sub, aside }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="label-caps">{eyebrow}</p>}
        <h1 className="mt-2 text-[2rem] font-bold leading-[1.1] text-ink sm:text-[2.6rem]">{title}</h1>
        {sub && <p className="mt-3 text-[1.05rem] leading-relaxed text-ink-2">{sub}</p>}
      </div>
      {aside}
    </header>
  );
}

/** Intentional empty state with a small animated illustration. */
export function EmptyState({ title, body, children }: { title: string; body: ReactNode; children?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center sm:py-20">
      <EmptyIllustration />
      <h2 className="mt-6 text-xl font-bold text-ink">{title}</h2>
      <p className="mt-2 max-w-md leading-relaxed text-ink-2">{body}</p>
      {children && <div className="mt-7 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}

function EmptyIllustration() {
  return (
    <svg width="148" height="72" viewBox="0 0 148 72" aria-hidden>
      <rect x="1" y="1" width="146" height="70" rx="18" fill="var(--color-sunken)" />
      <motion.path
        d="M14 48 C 30 48, 34 30, 48 30 S 64 44, 76 44 S 94 22, 106 22 S 122 36, 134 36"
        fill="none"
        stroke="var(--color-sage-bright)"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: EASE }}
      />
      <motion.circle
        cx="106"
        cy="22"
        r="5"
        fill="var(--color-amber-bright)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.1, type: "spring", stiffness: 300, damping: 14 }}
      />
    </svg>
  );
}

/** Segmented control (single choice). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-sunken p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`tap relative cursor-pointer rounded-full font-semibold transition-colors ${
              size === "sm" ? "h-8 px-3 text-[13px]" : "h-9 px-4 text-sm"
            } ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-full bg-surface shadow-[0_1px_3px_rgb(29_32_36/0.12)]"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function StatusPill({ status, size = "md" }: { status: "unusual" | "normal" | "below"; size?: "sm" | "md" }) {
  const map = {
    unusual: { cls: "bg-amber-soft text-amber", dot: "bg-amber-bright", text: "Unusual" },
    normal: { cls: "bg-sage-soft text-sage-strong", dot: "bg-sage-bright", text: "Normal" },
    below: { cls: "bg-blue-soft text-blue", dot: "bg-blue-bright", text: "Below expected" },
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${map.cls} ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${map.dot}`} />
      {map.text}
    </span>
  );
}

export function SourceBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-semibold text-ink-2">
      Example bills (research dataset)
    </span>
  );
}

/** Inline two-step confirmation for destructive actions (no browser dialogs). */
export function ConfirmInline({
  prompt,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  prompt: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-2 rounded-2xl bg-danger-soft px-3 py-2"
      role="alertdialog"
      aria-label={prompt}
    >
      <span className="text-sm font-medium text-danger">{prompt}</span>
      <Button size="sm" variant="danger" onClick={onConfirm} autoFocus>
        {confirmLabel}
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </motion.div>
  );
}

export function PrivacyNote({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`leading-relaxed text-ink-3 ${compact ? "text-xs" : "text-sm"}`}>
      Your analysis stays in this browser. This prototype uses local storage, and no energy data is sent to a generative AI
      API.
    </p>
  );
}
