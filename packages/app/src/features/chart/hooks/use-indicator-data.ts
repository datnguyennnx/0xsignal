import { useState, useSyncExternalStore } from "react";
import type { ChartDataPoint, ActiveIndicator } from "@0xsignal/shared";
import { calculateLineIndicator, calculateBandIndicator, isBandIndicator } from "@0xsignal/shared";
import type { IndicatorDataMeta, IndicatorRenderEntry } from "../utils/indicator-data";

const MAX_CACHE_SIZE = 50;

/** Shared empty result; consumers only read it. */
const EMPTY_ENTRIES = new Map<string, IndicatorRenderEntry>();

/**
 * Per-dataset LRU cache. Scoping entries to the exact dataset array means a
 * symbol/interval switch can never reuse them, and they are collected with it.
 */
const cachesByData = new WeakMap<ChartDataPoint[], Map<string, IndicatorRenderEntry>>();

const getCache = (data: ChartDataPoint[]): Map<string, IndicatorRenderEntry> => {
  let cache = cachesByData.get(data);
  if (cache === undefined) {
    cache = new Map();
    cachesByData.set(data, cache);
  }
  return cache;
};

const buildParamsKey = (params: Record<string, number>): string => {
  return Object.keys(params)
    .toSorted()
    .map((key) => `${key}:${String(params[key])}`)
    .join("|");
};

/**
 * Lookup identity for one indicator over one dataset: shape only, never the last
 * candle's OHLCV, so a tick that only moves the open candle keeps the same slot.
 */
const buildLookupKey = (
  indicatorId: string,
  paramsKey: string,
  dataLength: number,
  firstTime: number,
  lastTime: number,
): string => `${indicatorId}#${paramsKey}#${dataLength}#${firstTime}#${lastTime}`;

/** Evict LRU if at capacity, then cache the entry. */
const setCacheEntry = (
  cache: Map<string, IndicatorRenderEntry>,
  cacheKey: string,
  entry: IndicatorRenderEntry,
): void => {
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(cacheKey, entry);
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

const buildEntries = (
  activeIndicators: ActiveIndicator[],
  data: ChartDataPoint[],
): Map<string, IndicatorRenderEntry> => {
  if (data.length === 0) return EMPTY_ENTRIES;

  const cache = getCache(data);
  const firstTime = data[0].time;
  const last = data.at(-1);
  if (last === undefined) return EMPTY_ENTRIES;
  const lastTime = last.time;
  const signature = lastCandleSignature(data);

  const results = new Map<string, IndicatorRenderEntry>();

  for (const indicator of activeIndicators) {
    if (!indicator.visible) continue;

    const paramsKey = buildParamsKey(indicator.params);
    const lookupKey = buildLookupKey(
      indicator.instanceId,
      paramsKey,
      data.length,
      firstTime,
      lastTime,
    );

    const cached = cache.get(lookupKey);
    if (cached !== undefined) {
      // Bump to front (re-insert to maintain LRU order)
      cache.delete(lookupKey);
      cache.set(lookupKey, cached);
      results.set(indicator.instanceId, cached);
      continue;
    }

    const meta: IndicatorDataMeta = {
      // Content version: the overlay re-applies when the open candle moves.
      cacheKey: `${lookupKey}#${signature}`,
      paramsKey,
      mode: "setData",
      dataLength: data.length,
      lastTime,
    };

    if (isBandIndicator(indicator.instanceId)) {
      const bandData = calculateBandIndicator(indicator, data);
      if (bandData === null || bandData === undefined || bandData.length === 0) continue;
      const lastPoint = bandData.at(-1);
      if (lastPoint === undefined) continue;

      const entry: IndicatorRenderEntry = {
        type: "band",
        data: bandData,
        lastPoint,
        meta,
      };
      results.set(indicator.instanceId, entry);
      setCacheEntry(cache, lookupKey, entry);
      continue;
    }

    const lineData = calculateLineIndicator(indicator, data);
    if (lineData === null || lineData === undefined || lineData.length === 0) continue;
    const lastPoint = lineData.at(-1);
    if (lastPoint === undefined) continue;

    const entry: IndicatorRenderEntry = {
      type: indicator.config.output === "histogram" ? "histogram" : "line",
      data: lineData,
      lastPoint,
      meta,
    };
    results.set(indicator.instanceId, entry);
    setCacheEntry(cache, lookupKey, entry);
  }

  return results;
};

interface CommittedEntries {
  inputsKey: string;
  signature: string;
  entries: Map<string, IndicatorRenderEntry>;
}

interface DeferredJob {
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
    deferredJobs.set(slot, { inputsKey, signature, activeIndicators, data });
    scheduleFrame();
    return committed.entries;
  }

  deferredJobs.delete(slot);
  return committed.entries;
};
