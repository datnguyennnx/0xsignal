import type { SwingPoint, StructureEvent, OTEZone, TrendDirection } from "./types";
import { DIRECTION, FIB_LEVELS, GOLDEN_POCKET } from "../constants";

export const calculateOTEZones = (swings: SwingPoint[], events: StructureEvent[]): OTEZone[] => {
  const oteZones: OTEZone[] = [];
  const recentEvents = events.slice(-3);

  for (const event of recentEvents) {
    const relevantSwings = swings.filter((s) => s.index <= event.index);
    if (relevantSwings.length < 2) continue;

    const lastTwo = relevantSwings.slice(-2);
    const swingLow = Math.min(lastTwo[0].price, lastTwo[1].price);
    const swingHigh = Math.max(lastTwo[0].price, lastTwo[1].price);
    const range = swingHigh - swingLow;
    const dir = event.direction;
    const isBullish = dir === DIRECTION.BULLISH;

    const fibLevels: Record<string, number> = {
      [FIB_LEVELS["0"]]: isBullish ? swingLow : swingHigh,
      [FIB_LEVELS["0.236"]]: isBullish
        ? swingLow + range * FIB_LEVELS["0.236"]
        : swingHigh - range * FIB_LEVELS["0.236"],
      [FIB_LEVELS["0.382"]]: isBullish
        ? swingLow + range * FIB_LEVELS["0.382"]
        : swingHigh - range * FIB_LEVELS["0.382"],
      [FIB_LEVELS["0.5"]]: isBullish
        ? swingLow + range * FIB_LEVELS["0.5"]
        : swingHigh - range * FIB_LEVELS["0.5"],
      [FIB_LEVELS["0.618"]]: isBullish
        ? swingLow + range * FIB_LEVELS["0.618"]
        : swingHigh - range * FIB_LEVELS["0.618"],
      [FIB_LEVELS["0.786"]]: isBullish
        ? swingLow + range * FIB_LEVELS["0.786"]
        : swingHigh - range * FIB_LEVELS["0.786"],
      [FIB_LEVELS["1"]]: isBullish ? swingHigh : swingLow,
    };

    oteZones.push({
      startTime: lastTwo[0].time,
      endTime: lastTwo[1].time,
      direction: dir,
      fibLevels,
      goldenPocketHigh: fibLevels[GOLDEN_POCKET.HIGH],
      goldenPocketLow: fibLevels[GOLDEN_POCKET.LOW],
    });
  }

  return oteZones;
};

export const isPriceInOTE = (
  price: number,
  zones: OTEZone[],
  direction: TrendDirection
): boolean => {
  for (const zone of zones) {
    if (zone.direction !== direction) continue;
    if (price >= zone.goldenPocketLow && price <= zone.goldenPocketHigh) {
      return true;
    }
  }
  return false;
};

export const getActiveOTEZone = (
  zones: OTEZone[],
  price: number,
  direction: TrendDirection
): OTEZone | null => {
  for (const zone of zones.slice(-2)) {
    if (zone.direction !== direction) continue;
    if (price >= zone.goldenPocketLow && price <= zone.goldenPocketHigh) {
      return zone;
    }
  }
  return null;
};

export const getGoldenPocketZone = (zones: OTEZone[]): { low: number; high: number } | null => {
  if (zones.length === 0) return null;
  const lastZone = zones[zones.length - 1];
  return {
    low: lastZone.goldenPocketLow,
    high: lastZone.goldenPocketHigh,
  };
};
