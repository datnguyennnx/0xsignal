import type { ChartDataPoint } from "../types/chart";

type CandleInput = {
  timestamp?: string | number;
  time?: string | number;
  t?: number;
  open?: unknown;
  o?: unknown;
  high?: unknown;
  h?: unknown;
  low?: unknown;
  l?: unknown;
  close?: unknown;
  c?: unknown;
  volume?: unknown;
  v?: unknown;
};

function toNumericTimestampMs(value: string | number | undefined): number | null {
  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return value > 1_000_000_000_000 ? value : value * 1000;
    }
    return null;
  }
  if (typeof value !== "string") return null;
  const num = Number(value);
  if (Number.isFinite(num)) {
    return num > 1_000_000_000_000 ? num : num * 1000;
  }
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? dateMs : null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeCandle(input: CandleInput): ChartDataPoint | null {
  const tsMs = toNumericTimestampMs(input.timestamp ?? input.time ?? input.t);
  const open = toFiniteNumber(input.open ?? input.o);
  const high = toFiniteNumber(input.high ?? input.h);
  const low = toFiniteNumber(input.low ?? input.l);
  const close = toFiniteNumber(input.close ?? input.c);
  const volume = toFiniteNumber(input.volume ?? input.v);
  if (
    tsMs === null ||
    open === null ||
    high === null ||
    low === null ||
    close === null ||
    volume === null
  ) {
    return null;
  }
  return { time: Math.floor(tsMs / 1000), open, high, low, close, volume };
}
