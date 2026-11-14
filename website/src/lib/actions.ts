// Investigation suggestions for an unusually high bill. Deterministic rules based
// only on what WATTWISE knows: the building type, how far above normal the bill is,
// and the user's own bill history. It can't see devices, so these are checks, not diagnoses.

import type { ActionItem, Analysis, BuildingType } from "./storage";

const item = (id: string, category: ActionItem["category"], title: string, detail: string): ActionItem => ({ id, category, title, detail });

/** Up to three suggestions for an unusual bill; normal or lower bills get none. */
export function suggestActions(
  a: Pick<Analysis, "month" | "result">,
  buildingType: BuildingType | null,
  history: Analysis[],
): ActionItem[] {
  if (!a.result.flagged) return [];
  const workplace = buildingType === "office" || buildingType === "small-business";
  const pct = a.result.expectedKwh > 0 ? Math.round((a.result.residualKwh / a.result.expectedKwh) * 100) : null;
  const earlierHigh = history.filter((x) => x.result.flagged && x.month < a.month).length;

  const out: ActionItem[] = [];
  if (earlierHigh >= 1)
    out.push(
      item(
        "recurring",
        "timing",
        "Look for what repeats in your high months",
        `This is unusual month number ${earlierHigh + 1} in your history. Compare the high months: the same season, guests, a new appliance or a schedule change often explains a pattern.`,
      ),
    );
  out.push(
    item(
      "hvac",
      "cooling-heating",
      "Check heating and cooling",
      `Air conditioners, heaters and water heaters are the most common reason a monthly bill rises${pct !== null ? ` (this bill is ${pct}% above your normal)` : ""}. Check thermostat settings, timers, and units left running in empty rooms.`,
    ),
  );
  out.push(
    item(
      "highload",
      "high-load",
      "Review high-load appliances",
      "Anything new or used more this month: ovens, kettles, washers, dryers, geysers, pumps, heaters or machinery.",
    ),
  );
  if (workplace)
    out.push(item("lighting", "lighting", "Check lighting outside working hours", "Lights, signage or equipment left on overnight or at weekends add up over a month."));
  out.push(
    item(
      "standby",
      "standby",
      "Check devices left on standby",
      "TVs, consoles, routers, chargers and printers draw power all month while “off”. A power strip or smart plug makes them easy to switch off.",
    ),
  );
  return out.slice(0, 3);
}
