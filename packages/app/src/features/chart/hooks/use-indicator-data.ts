import { useEffect, useState, useSyncExternalStore } from "react";
import type { ChartDataPoint, ActiveIndicator } from "@0xsignal/shared";
import { calculateLineIndicator, calculateBandIndicator, isBandIndicator } from "@0xsignal/shared";
import type { IndicatorDataMeta, IndicatorRenderEntry } from "../utils/indicator-data";

export const MAX_CACHE_SIZE = 50;

/** Shared empty result; consumers only read it. */
const EMPTY_ENTRIES = new Map<string, IndicatorRenderEntry>();

/**
 * One LRU cache keyed by dataset signature, not array identity: two arrays with
 * identical contents reuse the same entries, so a re-created candle array no
 * longer forces a recompute. Eviction deletes the oldest key, which keeps the
 * cache bounded and lets evicted entries be collected.
 */
const entriesByKey = new Map<string, IndicatorRenderEntry>();

/** Exposed for tests: current number of cached indicator entries. */
export const getIndicatorCacheSize = (): number => entriesByKey.size;

const buildParamsKey = (params: Record<string, number>): string => {
  return Object.keys(params)
    .toSorted()
    .map((key) => `${key}:${String(params[key])}`)
    .join("|");
};

/**
 * Stable dataset signature: shape plus the last candle's OHLCV. Array identity is
 * deliberately excluded. Including the last (forming) candle is the conservative
 * choice: a tick that moves its close changes the key and recomputes, so the
 * forming bar is never served stale.
 */
const buildDatasetKey = (data: ChartDataPoint[]): string => {
  const first = data[0];
  const last = data.at(-1);
  if (first === undefined || last === undefined) return "empty";
  return `${data.length}#${first.time}#${first.close}#${last.time}#${last.open}#${last.high}#${last.low}#${last.close}#${last.volume}`;
};

/**
 * Lookup identity for one indicator over one dataset: the dataset signature plus
 * the indicator id and params.
 */
const buildLookupKey = (indicatorId: string, paramsKey: string, datasetKey: string): string =>
  `${indicatorId}#${paramsKey}#${datasetKey}`;

/** Evict LRU if at capacity, then cache the entry. */
const setCacheEntry = (cacheKey: string, entry: IndicatorRenderEntry): void => {
  if (entriesByKey.size >= MAX_CACHE_SIZE) {
    const firstKey = entriesByKey.keys().next().value;
    if (firstKey !== undefined) entriesByKey.delete(firstKey);
  }
  entriesByKey.set(cacheKey, entry);
};

/** Whole-input identity that excludes the per-tick OHLCV of the open candle. */
const describeInputs = (activeIndicators: ActiveIndicator[], data: ChartDataPoint[]): string => {
  const first = data[0];
  const last = data.at(-1);
  let indicatorPart = "";
  for (const indicator of activeIndicators) {
    const visibility = indicator.visible ? "1" : "0";
    indicatorPart += `${indicator.instanceId}:${visibility}:${buildParamsKey(indicator.params)};`;
  }
  const firstTime = first === undefined ? 0 : first.time;
  const firstClose = first === undefined ? 0 : first.close;
  const lastTime = last === undefined ? 0 : last.time;
  return `${data.length}|${firstTime}|${firstClose}|${lastTime}|${indicatorPart}`;
};

/** The only part of the dataset that changes between ticks. */
const lastCandleSignature = (data: ChartDataPoint[]): string => {
  const last = data.at(-1);
  if (last === undefined) return "";
  return `${last.time}|${last.open}|${last.high}|${last.low}|${last.close}|${last.volume}`;
};

export const buildEntries = (
  activeIndicators: ActiveIndicator[],
  data: ChartDataPoint[],
): Map<string, IndicatorRenderEntry> => {
  if (data.length === 0) return EMPTY_ENTRIES;

  const dataKey = buildDatasetKey(data);
  const signature = lastCandleSignature(data);

  const results = new Map<string, IndicatorRenderEntry>();

  for (const indicator of activeIndicators) {
    if (!indicator.visible) continue;

    const paramsKey = buildParamsKey(indicator.params);
    const lookupKey = buildLookupKey(indicator.instanceId, paramsKey, dataKey);

    const cached = entriesByKey.get(lookupKey);
    if (cached !== undefined) {
      // Bump to front (re-insert to maintain LRU order)
      entriesByKey.delete(lookupKey);
      entriesByKey.set(lookupKey, cached);
      results.set(indicator.instanceId, cached);
      continue;
    }

    const meta: IndicatorDataMeta = {
      // Content version: the overlay re-applies when the open candle moves.
      cacheKey: `${lookupKey}#${signature}`,
    };

    if (isBandIndicator(indicator.instanceId)) {
      const bandData = calculateBandIndicator(indicator, data);
      if (bandData === null || bandData === undefined || bandData.length === 0) continue;

      const entry: IndicatorRenderEntry = {
        type: "band",
        data: bandData,
        meta,
      };
      results.set(indicator.instanceId, entry);
      setCacheEntry(lookupKey, entry);
      continue;
    }

    const lineData = calculateLineIndicator(indicator, data);
    if (lineData === null || lineData === undefined || lineData.length === 0) continue;

    const entry: IndicatorRenderEntry = {
      type: indicator.config.output === "histogram" ? "histogram" : "line",
      data: lineData,
      meta,
    };
    results.set(indicator.instanceId, entry);
    setCacheEntry(lookupKey, entry);
  }

  return results;
};

interface CommittedEntries {
  inputsKey: string;
  signature: string;
  entries: Map<string, IndicatorRenderEntry>;
}

export interface DeferredJob {
  inputsKey: string;
  signature: string;
  activeIndicators: ActiveIndicator[];
  data: ChartDataPoint[];
}

/**
 * Marks the decisions taken while rendering, keyed by a per-hook slot object.
 * A tick only moves the open candle, so the committed series is returned as-is
 * and the recompute is queued for the next painted frame.
 */
const committedBySlot = new WeakMap<object, CommittedEntries>();
const deferredJobs = new Map<object, DeferredJob>();
const frameListeners = new Set<() => void>();

let frameId = 0;
let frameVersion = 0;

const flushFrame = (): void => {
  frameId = 0;
  for (const [slot, job] of deferredJobs) {
    committedBySlot.set(slot, {
      inputsKey: job.inputsKey,
      signature: job.signature,
      entries: buildEntries(job.activeIndicators, job.data),
    });
  }
  deferredJobs.clear();

  frameVersion += 1;
  for (const listener of frameListeners) listener();
};

const scheduleFrame = (): void => {
  if (frameId !== 0) return;
  frameId = requestAnimationFrame(flushFrame);
};

/** Exposed for tests: current number of queued deferred jobs. */
export const getDeferredJobCount = (): number => deferredJobs.size;

/** Queue the per-slot recompute and make sure a frame is pending. */
export const scheduleDeferredJob = (slot: object, job: DeferredJob): void => {
  deferredJobs.set(slot, job);
  scheduleFrame();
};

/**
 * Drop a slot's queued job before its frame runs. Once no job remains the frame
 * has nothing to paint, so cancel it instead of retaining the dataset until the
 * tab becomes visible again.
 */
export const disposeDeferredJob = (slot: object): void => {
  deferredJobs.delete(slot);
  if (deferredJobs.size === 0 && frameId !== 0) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
};

const subscribeFrames = (listener: () => void): (() => void) => {
  frameListeners.add(listener);
  return () => {
    frameListeners.delete(listener);
  };
};

const getFrameVersion = (): number => frameVersion;

export const useIndicatorData = (activeIndicators: ActiveIndicator[], data: ChartDataPoint[]) => {
  const [slot] = useState<object>(() => ({}));
  useSyncExternalStore(subscribeFrames, getFrameVersion);

  useEffect(() => {
    return () => {
      disposeDeferredJob(slot);
    };
  }, [slot]);

  const inputsKey = describeInputs(activeIndicators, data);
  const signature = lastCandleSignature(data);
  const committed = committedBySlot.get(slot);

  if (committed === undefined || committed.inputsKey !== inputsKey) {
    // First series, indicator change, or dataset reshape: compute now.
    const entries = buildEntries(activeIndicators, data);
    committedBySlot.set(slot, { inputsKey, signature, entries });
    deferredJobs.delete(slot);
    return entries;
  }

  if (committed.signature !== signature) {
    scheduleDeferredJob(slot, { inputsKey, signature, activeIndicators, data });
    return committed.entries;
  }

  deferredJobs.delete(slot);
  return committed.entries;
};
