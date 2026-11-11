import { cast, type DecimalString } from "@0xsignal/sdk-hyperliquid";
import type { BookFrame as SdkBookFrame, BookLevel } from "@0xsignal/sdk-hyperliquid/subscription";
import { MAX_BOOK_DEPTH } from "@/core/utils/hyperliquid";

export interface BookFrame {
  readonly levels: [unknown[], unknown[]];
  readonly time: number;
}

export type BookDegradedLeg = "fast" | "slow";

export type BookLegFrame = SdkBookFrame & { readonly fast: boolean | undefined };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sliceSide = (side: unknown[]): unknown[] => side.slice(0, MAX_BOOK_DEPTH);

const isLevelsPair = (value: unknown): value is [unknown[], unknown[]] =>
  Array.isArray(value) && value.length === 2 && Array.isArray(value[0]) && Array.isArray(value[1]);

const frameSourceOf = (
  event: Record<string, unknown>,
): { levels: [unknown[], unknown[]]; time: unknown; fast: unknown } | null => {
  if (isLevelsPair(event.levels)) {
    return { levels: event.levels, time: event.time, fast: event.fast };
  }
  const nested = event.data;
  if (isRecord(nested) && isLevelsPair(nested.levels)) {
    return { levels: nested.levels, time: nested.time, fast: nested.fast };
  }
  return null;
};

const decimal = (value: string): DecimalString => cast<DecimalString>(value, "level");

const readLevels = (side: unknown[]): BookLevel[] | null => {
  const levels: BookLevel[] = [];
  for (const entry of side) {
    if (!isRecord(entry)) return null;
    const px = entry["px"];
    const sz = entry["sz"];
    const n = entry["n"];
    if (typeof px !== "string" || typeof sz !== "string" || typeof n !== "number") return null;
    levels.push({ px: decimal(px), sz: decimal(sz), n });
  }
  return levels;
};

const coinOf = (event: Record<string, unknown>): string => {
  if (typeof event.coin === "string") return event.coin;
  const nested = event.data;
  return isRecord(nested) && typeof nested.coin === "string" ? nested.coin : "";
};

export const readBookSnapshot = (event: unknown): BookFrame | null => {
  if (!isRecord(event)) return null;
  const source = frameSourceOf(event);
  if (source === null) return null;
  return {
    levels: [sliceSide(source.levels[0]), sliceSide(source.levels[1])],
    time: typeof source.time === "number" ? source.time : Date.now(),
  };
};

export const readBookLeg = (event: unknown): BookLegFrame | null => {
  if (!isRecord(event)) return null;
  const source = frameSourceOf(event);
  if (source === null) return null;
  const bids = readLevels(source.levels[0]);
  const asks = readLevels(source.levels[1]);
  if (bids === null || asks === null) return null;
  return {
    coin: coinOf(event),
    time: typeof source.time === "number" ? source.time : Date.now(),
    fast: typeof source.fast === "boolean" ? source.fast : undefined,
    levels: [bids, asks],
  };
};
