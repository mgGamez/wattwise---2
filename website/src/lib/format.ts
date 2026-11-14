// Timestamps in the dataset are local house time ("2016-05-21 09:40:00").
// We parse them as plain fields (UTC maths) so server and browser render the
// exact same text regardless of the viewer's timezone (no hydration mismatch).

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(t: string) {
  const [d, time = "00:00:00"] = t.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return { y, m, day, hh, mm, weekday };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "Sat 21 May 2016 · 09:40" */
export function fmtTimestamp(t: string) {
  const p = parts(t);
  return `${DAYS[p.weekday]} ${p.day} ${MONTHS[p.m - 1]} ${p.y} · ${pad(p.hh)}:${pad(p.mm)}`;
}

/** "21 May 2016" */
export function fmtDate(t: string) {
  const p = parts(t);
  return `${p.day} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** "21 May" */
export function fmtShortDate(t: string) {
  const p = parts(t);
  return `${p.day} ${MONTHS[p.m - 1]}`;
}

/** "09:40" */
export function fmtClock(t: string) {
  const p = parts(t);
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

/** "Sat 09:40" */
export function fmtDayClock(t: string) {
  const p = parts(t);
  return `${DAYS[p.weekday]} ${pad(p.hh)}:${pad(p.mm)}`;
}

export function hourOf(t: string) {
  return parts(t).hh;
}
export function minuteOf(t: string) {
  return parts(t).mm;
}

export function fmtNum(v: number, digits = 0) {
  return v.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtSigned(v: number, digits = 0) {
  return `${v >= 0 ? "+" : "−"}${fmtNum(Math.abs(v), digits)}`;
}

/** Percentile with ordinal-free wording: "99.5th percentile" */
export function fmtPercentile(v: number) {
  return `${fmtNum(v, 1)}th`;
}

export const FEATURE_LABELS: Record<string, string> = {
  hour: "Hour of day",
  hour_cyclic: "Hour of day (cyclic)",
  day_of_week: "Day of week",
  day_of_week_cyclic: "Day of week (cyclic)",
  is_weekend: "Weekend flag",
  previous_interval: "Previous 10 minutes",
  previous_hour: "Same slot, 1 hour ago",
  previous_day_same_time: "Same time yesterday",
  rolling_1h_mean: "Average of the last hour",
  rolling_6h_mean: "Average of the last 6 hours",
  rolling_24h_mean: "Average of the last 24 hours",
  lights_previous_interval: "Lighting use, previous 10 min",
  outdoor_weather_previous_interval: "Outdoor weather",
  indoor_conditions_previous_interval: "Indoor temperature & humidity",
};

export const featureLabel = (f: string) => FEATURE_LABELS[f] ?? f.replaceAll("_", " ");
