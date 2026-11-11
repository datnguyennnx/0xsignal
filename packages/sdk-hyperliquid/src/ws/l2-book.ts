import type { DecimalString } from "../core/brands";
import { compareDecimal } from "../core/decimal";

export type BookLevel = {
  readonly px: DecimalString;
  readonly sz: DecimalString;
  readonly n: number;
};

export type BookFrame = {
  readonly coin: string;
  readonly time: number;
  readonly levels: readonly [readonly BookLevel[], readonly BookLevel[]];
};

export type BookLeg = "fast" | "slow";

export type MergedBook = {
  readonly coin: string;
  readonly time: number;
  readonly levels: readonly [readonly BookLevel[], readonly BookLevel[]];
  readonly degraded: readonly BookLeg[];
};

export const FAST_STALE_MS = 1500;
export const SLOW_STALE_MS = 8000;
export const FAST_DROP_MS = 60000;
export const SLOW_DROP_MS = 60000;
export const DEFAULT_BOOK_DEPTH = 20;

const isDescending = (levels: readonly BookLevel[]): boolean => {
  for (let i = 1; i < levels.length; i += 1) {
    const previous = levels[i - 1];
    const current = levels[i];
    if (previous === undefined || current === undefined) return false;
    if (compareDecimal(previous.px, current.px) < 0) return false;
  }
  return true;
};

const isAscending = (levels: readonly BookLevel[]): boolean => {
  for (let i = 1; i < levels.length; i += 1) {
    const previous = levels[i - 1];
    const current = levels[i];
    if (previous === undefined || current === undefined) return false;
    if (compareDecimal(previous.px, current.px) > 0) return false;
  }
  return true;
};

const orderCache = new WeakMap<BookFrame, boolean>();

const isOrdered = (frame: BookFrame): boolean => {
  const cached = orderCache.get(frame);
  if (cached !== undefined) return cached;
  const ordered = isDescending(frame.levels[0]) && isAscending(frame.levels[1]);
  orderCache.set(frame, ordered);
  return ordered;
};

type Assessment = { readonly frame: BookFrame | null; readonly degraded: boolean };

const assess = (
  frame: BookFrame | null,
  softMs: number,
  dropMs: number,
  now: number,
): Assessment => {
  if (frame === null) return { frame: null, degraded: true };
  if (!isOrdered(frame)) return { frame: null, degraded: true };
  const age = now - frame.time;
  if (age > dropMs) return { frame: null, degraded: true };
  return { frame, degraded: age > softMs };
};

const truncateSide = (levels: readonly BookLevel[], depth: number): BookLevel[] =>
  levels.length <= depth ? levels.slice() : levels.slice(0, depth);

const unionSide = (
  fast: readonly BookLevel[],
  slow: readonly BookLevel[],
  ascending: boolean,
  depth: number,
): BookLevel[] => {
  const out: BookLevel[] = [];
  let fi = 0;
  let si = 0;
  while (out.length < depth && (fi < fast.length || si < slow.length)) {
    const head = fast[fi];
    const tail = slow[si];
    let next: BookLevel;
    if (head !== undefined && tail !== undefined) {
      const order = compareDecimal(head.px, tail.px);
      if (order === 0) {
        next = head;
        fi += 1;
        si += 1;
      } else if (ascending ? order < 0 : order > 0) {
        next = head;
        fi += 1;
      } else {
        next = tail;
        si += 1;
      }
    } else if (head !== undefined) {
      next = head;
      fi += 1;
    } else if (tail === undefined) {
      break;
    } else {
      next = tail;
      si += 1;
    }
    const previous = out.at(-1);
    if (previous !== undefined && compareDecimal(previous.px, next.px) === 0) continue;
    out.push(next);
  }
  return out;
};

const mergeOne = (frame: BookFrame, degraded: readonly BookLeg[], depth: number): MergedBook => ({
  coin: frame.coin,
  time: frame.time,
  levels: [truncateSide(frame.levels[0], depth), truncateSide(frame.levels[1], depth)],
  degraded,
});

export function mergeL2Book(
  fast: BookFrame | null,
  slow: BookFrame | null,
  maxDepth: number = DEFAULT_BOOK_DEPTH,
  now: number = Date.now(),
): MergedBook | null {
  const depth = Math.max(0, Math.floor(maxDepth));
  const fastState = assess(fast, FAST_STALE_MS, FAST_DROP_MS, now);
  const slowState = assess(slow, SLOW_STALE_MS, SLOW_DROP_MS, now);
  const fastFrame = fastState.frame;
  const slowFrame = slowState.frame;
  if (fastFrame === null && slowFrame === null) return null;
  const degraded: BookLeg[] = [];
  if (fastState.degraded) degraded.push("fast");
  if (slowState.degraded) degraded.push("slow");
  if (fastFrame !== null && slowFrame === null) return mergeOne(fastFrame, degraded, depth);
  if (fastFrame === null && slowFrame !== null) return mergeOne(slowFrame, degraded, depth);
  if (fastFrame === null || slowFrame === null) return null;
  return {
    coin: fastFrame.coin,
    time: Math.max(fastFrame.time, slowFrame.time),
    levels: [
      unionSide(fastFrame.levels[0], slowFrame.levels[0], false, depth),
      unionSide(fastFrame.levels[1], slowFrame.levels[1], true, depth),
    ],
    degraded,
  };
}
