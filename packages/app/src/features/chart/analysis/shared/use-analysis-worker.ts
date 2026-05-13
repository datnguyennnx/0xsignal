/**
 * @overview Generic analysis worker hook.
 *
 * Provides debounced async analysis with request-ID cancellation.
 * Used by ICT, Wyckoff, and any future pattern analysis modules.
 *
 * @mechanism
 * - Calls the provided `analyzeFn` (pure function from @0xsignal/shared) on candle data.
 * - Implements request-ID tracking so only the latest request updates state.
 * - Supports optional debounce to avoid re-computation on every candle tick.
 */
import { useRef, useCallback, useEffect, useState } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";

export interface UseAnalysisWorkerOptions<TConfig, TResult> {
  data: ChartDataPoint[];
  enabled: boolean;
  config?: Partial<TConfig>;
  defaultConfig: TConfig;
  analyzeFn: (data: ChartDataPoint[], config: TConfig) => TResult;
  minCandles?: number;
  debounceMs?: number;
}

export interface UseAnalysisWorkerResult<TResult> {
  analysis: TResult | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const DEFAULT_MIN_CANDLES = 30;
const DEFAULT_DEBOUNCE_MS = 150;

export function useAnalysisWorker<TConfig, TResult>({
  data,
  enabled,
  config,
  defaultConfig,
  analyzeFn,
  minCandles = DEFAULT_MIN_CANDLES,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseAnalysisWorkerOptions<TConfig, TResult>): UseAnalysisWorkerResult<TResult> {
  const latestRequestIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [analysis, setAnalysis] = useState<TResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runImmediate = useCallback(() => {
    if (!enabled || data.length < minCandles) return;

    setIsLoading(true);
    setError(null);

    const id = `analysis-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    latestRequestIdRef.current = id;

    try {
      const mergedConfig = { ...defaultConfig, ...config } as TConfig;
      const result = analyzeFn(data, mergedConfig);
      if (id === latestRequestIdRef.current) {
        setAnalysis(result);
        setError(null);
      }
    } catch (err) {
      if (id === latestRequestIdRef.current) {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setAnalysis(null);
      }
    } finally {
      if (id === latestRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [data, config, enabled, minCandles, analyzeFn, defaultConfig]);

  const runDebounced = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(runImmediate, debounceMs);
  }, [runImmediate, debounceMs]);

  useEffect(() => {
    if (enabled && data.length >= minCandles) {
      runDebounced();
    } else if (!enabled) {
      setAnalysis(null);
      setError(null);
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [data, enabled, minCandles, runDebounced]);

  return { analysis, isLoading, error, refresh: runImmediate };
}
