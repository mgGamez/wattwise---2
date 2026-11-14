import type { AppState, CurrencyCode } from "./storage";

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: "INR", label: "Indian rupee (₹)" },
  { code: "USD", label: "US dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British pound (£)" },
  { code: "AUD", label: "Australian dollar (A$)" },
  { code: "CAD", label: "Canadian dollar (C$)" },
  { code: "SGD", label: "Singapore dollar (S$)" },
  { code: "AED", label: "UAE dirham (AED)" },
];

export function currencySymbol(code: CurrencyCode) {
  return (
    new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? code
  );
}

/** Money with 2 decimals; tiny non-zero amounts get more precision instead of showing 0.00. */
export function fmtMoney(amount: number, code: CurrencyCode) {
  const abs = Math.abs(amount);
  const digits = abs > 0 && abs < 0.01 ? 4 : 2;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

/** Wh -> kWh -> cost at the stored tariff. */
export function costOf(wh: number, tariff: AppState["tariff"]) {
  if (!tariff) return null;
  return (wh / 1000) * tariff.perKwh;
}

export function fmtWh(wh: number, digits = 0) {
  return `${wh.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits })} Wh`;
}

export function fmtKwh(wh: number) {
  const kwh = wh / 1000;
  const digits = kwh === 0 ? 2 : kwh < 0.1 ? 3 : 2;
  return `${kwh.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits })} kWh`;
}

export const fmtNum = (v: number, digits = 0) =>
  v.toLocaleString("en", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function fmtSignedWh(v: number) {
  return `${v >= 0 ? "+" : "−"}${fmtNum(Math.abs(v))} Wh`;
}

/**
 * Percentile as an ordinal: nearest whole number, but "100th" only when the value
 * really is 100 (so 99.5 reads "99th" and 95.996 reads "96th").
 */
export function ordinal(n: number) {
  const r = n >= 100 ? 100 : Math.min(Math.round(n), 99);
  const s = ["th", "st", "nd", "rd"];
  const v = r % 100;
  return `${r}${s[(v - 20) % 10] || s[v] || s[0]}`;
}
