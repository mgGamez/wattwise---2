// Investigation suggestions. Deterministic rules based ONLY on what WATTWISE knows:
// the reading time, the building type, the size of the unexpected gap and the
// user's own saved history. WATTWISE does not know which device was running, so
// these are things worth checking — never a diagnosis.

import type { ActionItem, Analysis, BuildingType } from "./storage";
import { fmtClock, hourOf, weekdayOf } from "./time";

const LIB: Record<string, Omit<ActionItem, "detail"> & { base: string }> = {
  overnight: {
    id: "overnight",
    category: "standby",
    title: "Look for devices left running overnight",
    base: "Heaters, chargers, pumps or appliances left on after everyone has gone to sleep.",
  },
  standby: {
    id: "standby",
    category: "standby",
    title: "Check standby electronics",
    base: "TVs, consoles, routers, printers and chargers can draw power while “off”. Smart plugs or a power strip make them easy to switch off.",
  },
  lighting: {
    id: "lighting",
    category: "lighting",
    title: "Check lighting outside occupied hours",
    base: "Lights or signage on timers, or rooms left lit when nobody is there.",
  },
  hvac: {
    id: "hvac",
    category: "cooling-heating",
    title: "Check cooling/heating schedules",
    base: "Thermostat schedules, set-points and units running in empty rooms are common sources of extra use.",
  },
  highload: {
    id: "highload",
    category: "high-load",
    title: "Review high-load equipment",
    base: "Ovens, kettles, washers, dryers, water heaters, pumps or machinery that draw a lot of power at once.",
  },
  recurring: {
    id: "recurring",
    category: "timing",
    title: "Investigate recurring anomaly times",
    base: "Unusual readings that repeat at the same time of day often point to a schedule or timer.",
  },
};

function item(key: keyof typeof LIB, why: string): ActionItem {
  const { base, ...rest } = LIB[key];
  return { ...rest, detail: `${base} ${why}` };
}

/**
 * Up to three suggestions for an unusual reading. Normal or below-expected
 * readings get none: there is no unexpected use to investigate.
 */
export function suggestActions(
  a: Pick<Analysis, "timestamp" | "result">,
  buildingType: BuildingType | null,
  history: Analysis[],
): ActionItem[] {
  if (!a.result.flagged) return [];
  const h = hourOf(a.timestamp);
  const wd = weekdayOf(a.timestamp);
  const weekend = wd === 0 || wd === 6;
  const night = h >= 22 || h < 6;
  const workplace = buildingType === "office" || buildingType === "small-business";
  const outsideWorkHours = workplace && (weekend || h < 8 || h >= 19);
  const big = a.result.residualWh >= 2 * a.result.thresholdWh;
  const at = fmtClock(a.timestamp);

  const sameTime = history.filter(
    (x) => x.result.flagged && x.timestamp !== a.timestamp && Math.min(Math.abs(hourOf(x.timestamp) - h), 24 - Math.abs(hourOf(x.timestamp) - h)) <= 1,
  ).length;

  const out: ActionItem[] = [];
  const add = (x: ActionItem) => {
    if (out.length < 3 && !out.some((o) => o.id === x.id)) out.push(x);
  };

  if (sameTime >= 1)
    add(item("recurring", `Suggested because this is unusual reading number ${sameTime + 1} around ${String(h).padStart(2, "0")}:00 in your history.`));
  if (night) add(item("overnight", `Suggested because the reading was at ${at}, a time most buildings are quiet.`));
  if (outsideWorkHours)
    add(item("lighting", `Suggested because the reading was ${weekend ? "on a weekend" : `at ${at}`}, outside typical working hours.`));
  if (big)
    add(item("highload", "Suggested because use was more than twice the detection threshold above what was expected."));
  if (!night && !outsideWorkHours) add(item("hvac", `Suggested because the reading was at ${at}, when heating or cooling is often scheduled.`));
  if (night) add(item("standby", "Suggested because night-time use often includes devices on standby."));
  // fill to three with general, still-relevant checks
  add(item("highload", "A general check for any unexpected high reading."));
  add(item("hvac", "A general check for any unexpected high reading."));
  add(item("standby", "A general check for any unexpected high reading."));
  return out;
}
