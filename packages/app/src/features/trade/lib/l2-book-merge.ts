// l2Book has two variants: slow (20 levels) and fast (5 levels, shorter cadence).
// 20 is the protocol ceiling: the WS schema caps one side at 20 levels, so the
// fast leg can only sharpen the top of the book, never extend it.

import { MAX_BOOK_DEPTH } from "@/core/utils/hyperliquid";

export type BookLeg = "fast" | "slow";

export interface BookFrame {
  readonly levels: [unknown[], unknown[]];
  readonly time: number;
}

export interface BookMergeState {
  fast: BookFrame | null;
  slow: BookFrame | null;
}

export interface ClosableHandle {
  unsubscribe(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/**
 * The frame owns its leg: the transport hands every frame to every listener on
 * the shared channel name, so the label captured at subscribe time can drift.
 * No `fast` flag means the slow snapshot.
 */
export const bookFrameLeg = (event: unknown): BookLeg =>
  isRecord(event) && event.fast === true ? "fast" : "slow";

const parseBookFrame = (event: unknown): BookFrame | null => {
  if (!isRecord(event)) return null;
  const levels: unknown = event.levels;
  if (!Array.isArray(levels)) return null;
  const bids: unknown = levels[0];
  const asks: unknown = levels[1];
  if (!Array.isArray(bids) || !Array.isArray(asks)) return null;
  return { levels: [bids, asks], time: typeof event.time === "number" ? event.time : Date.now() };
};

const priceOf = (level: unknown): string | null =>
  isRecord(level) && typeof level.px === "string" ? level.px : null;

const isOrdered = (levels: readonly unknown[], side: 0 | 1): boolean => {
  let previous: number | null = null;
  for (const level of levels) {
    const price = priceOf(level);
    if (price === null) return false;
    const current = Number(price);
    if (!Number.isFinite(current)) return false;
    if (previous !== null && (side === 0 ? current >= previous : current <= previous)) return false;
    previous = current;
  }
  return true;
};

/**
 * Slow supplies depth first, then fast overwrites by price: fast is the fresher
 * top of book, slow the deeper tail. O(levels) for ordered input; the sort is
 * the O(n log n) fallback for a leg that arrives unordered.
 */
const mergeSide = (fast: readonly unknown[], slow: readonly unknown[], side: 0 | 1): unknown[] => {
  const byPrice = new Map<string, unknown>();
  for (const level of slow) {
    const price = priceOf(level);
    if (price !== null) byPrice.set(price, level);
  }
  for (const level of fast) {
    const price = priceOf(level);
    if (price !== null) byPrice.set(price, level);
  }

  const merged: unknown[] = [];
  for (const level of byPrice.values()) merged.push(level);
  if (!isOrdered(merged, side)) {
    merged.sort((a, b) => {
      const left = Number(priceOf(a));
      const right = Number(priceOf(b));
      return side === 0 ? right - left : left - right;
    });
  }
  merged.length = Math.min(merged.length, MAX_BOOK_DEPTH);
  return merged;
};

const mergeBookFrames = ({ fast, slow }: BookMergeState): BookFrame | null => {
  if (fast === null && slow === null) return null;
  return {
    levels: [
      mergeSide(fast?.levels[0] ?? [], slow?.levels[0] ?? [], 0),
      mergeSide(fast?.levels[1] ?? [], slow?.levels[1] ?? [], 1),
    ],
    time: Math.max(fast?.time ?? 0, slow?.time ?? 0),
  };
};

export const createBookMergeState = (): BookMergeState => ({ fast: null, slow: null });

/** Stores one leg's frame and returns the merged full snapshot, or null if unparsable. */
export const applyBookFrame = (
  state: BookMergeState,
  leg: BookLeg,
  event: unknown,
): BookFrame | null => {
  const frame = parseBookFrame(event);
  if (frame === null) return null;
  state[leg] = frame;
  return mergeBookFrames(state);
};

/** Opens both legs as one unit; a failed leg tears down the other. */
export async function openBoth<T extends ClosableHandle>(
  legs: readonly Promise<T>[],
): Promise<T[]> {
  const results = await Promise.allSettled(legs);
  const handles: T[] = [];
  let failure: Error | null = null;
  for (const result of results) {
    if (result.status === "fulfilled") handles.push(result.value);
    else failure = toError(result.reason);
  }
  if (failure === null) return handles;
  for (const handle of handles) handle.unsubscribe();
  throw failure;
}
