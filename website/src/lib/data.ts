import raw from "@/data/site-data.json";
import type { SiteData } from "./types";

// Real ML outputs, converted at build time. See scripts/build-data.mjs.
export const site = raw as unknown as SiteData;

export const UNIT = "Wh per 10-minute interval";
export const UNIT_SHORT = "Wh";
