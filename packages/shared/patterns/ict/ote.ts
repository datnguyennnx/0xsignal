import type { SwingPoint, StructureEvent, OTEZone, TrendDirection } from "./types";

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

    const fibLevels: Record<string, number> = {
      "0": dir === "bullish" ? swingLow : swingHigh,
      "0.236": dir === "bullish" ? swingLow + range * 0.236 : swingHigh - range * 0.236,
      "0.382": dir === "bullish" ? swingLow + range * 0.382 : swingHigh - range * 0.382,
      "0.5": dir === "bullish" ? swingLow + range * 0.5 : swingHigh - range * 0.5,
      "0.618": dir === "bullish" ? swingLow + range * 0.618 : swingHigh - range * 0.618,
      "0.786": dir === "bullish" ? swingLow + range * 0.786 : swingHigh - range * 0.786,
      "1": dir === "bullish" ? swingHigh : swingLow,
    };

    oteZones.push({
      startTime: lastTwo[0].time,
      endTime: lastTwo[1].time,
      direction: dir,
      fibLevels,
      goldenPocketHigh: fibLevels["0.618"],
      goldenPocketLow: fibLevels["0.786"],
    });
  }

  return oteZones;
};

export const getOTEEntry = (
  oteZones: OTEZone[],
  direction: TrendDirection,
  entryLevel: number = 0.618
): number | null => {
  if (oteZones.length === 0) return null;

  const lastZone = oteZones[oteZones.length - 1];
  const key = entryLevel.toString();
  return lastZone.fibLevels[key] ?? null;
};

export const getGoldenPocketZone = (oteZones: OTEZone[]): { high: number; low: number } | null => {
  if (oteZones.length === 0) return null;

  const lastZone = oteZones[oteZones.length - 1];
  return {
    high: lastZone.goldenPocketHigh,
    low: lastZone.goldenPocketLow,
  };
};

export const isPriceInOTE = (
  price: number,
  oteZones: OTEZone[],
  direction: TrendDirection
): boolean => {
  if (oteZones.length === 0) return false;

  const lastZone = oteZones[oteZones.length - 1];
  if (direction === "bullish") {
    return price >= lastZone.goldenPocketLow && price <= lastZone.goldenPocketHigh;
  } else {
    return price >= lastZone.goldenPocketLow && price <= lastZone.goldenPocketHigh;
  }
};
