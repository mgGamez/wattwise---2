// Reading times are local wall-clock strings "YYYY-MM-DDTHH:mm" (no timezone),
// the same convention as the dataset. All maths uses UTC fields on purpose so the
// result never depends on the viewer's timezone or daylight-saving changes.

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

export function parseLocal(t: string) {
  const [d, time = "00:00"] = t.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return { y, m, day, hh, mm, ms: Date.UTC(y, m - 1, day, hh, mm) };
}

export function fromMs(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function isValidLocal(t: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) return false;
  const p = parseLocal(t);
  return fromMs(p.ms) === t;
}

/** Shift by a number of minutes. */
export const addMinutes = (t: string, minutes: number) => fromMs(parseLocal(t).ms + minutes * 60_000);

/** Round down to the start of its 10-minute interval. */
export function floorTo10(t: string) {
  const p = parseLocal(t);
  return fromMs(p.ms - (p.mm % 10) * 60_000);
}

/** The viewer's current local time as "YYYY-MM-DDTHH:mm". */
export function nowLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "Sat 21 May 2016 · 09:40" */
export function fmtWhen(t: string) {
  const p = parseLocal(t);
  return `${DAYS[new Date(p.ms).getUTCDay()]} ${p.day} ${MONTHS[p.m - 1]} ${p.y} · ${pad(p.hh)}:${pad(p.mm)}`;
}
/** "21 May" */
export function fmtDay(t: string) {
  const p = parseLocal(t);
  return `${p.day} ${MONTHS[p.m - 1]}`;
}
/** "09:40" */
export function fmtClock(t: string) {
  const p = parseLocal(t);
  return `${pad(p.hh)}:${pad(p.mm)}`;
}
/** "09:40–09:50" */
export function fmtInterval(t: string) {
  return `${fmtClock(t)}–${fmtClock(addMinutes(t, 10))}`;
}

export const hourOf = (t: string) => parseLocal(t).hh;
export const weekdayOf = (t: string) => new Date(parseLocal(t).ms).getUTCDay();

export function greeting(hour = new Date().getHours()) {
  if (hour < 5) return "Good evening.";
  if (hour < 12) return "Good morning.";
  if (hour < 17) return "Good afternoon.";
  return "Good evening.";
}

/** "3 minutes ago" style for ISO timestamps (when an analysis was run). */
export function fmtRelative(iso: string) {
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
