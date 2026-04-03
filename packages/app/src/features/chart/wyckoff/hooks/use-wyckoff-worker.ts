/**
 * @overview Wyckoff Analysis Worker Hook
 *
 * Provides a React hook interface for the Wyckoff pattern analysis engine.
 * Handles async execution, error states, and cancellation (AbortController) to keep UI responsive.
 *
 * @mechanism
 * - uses analyzeWyckoff from @0xsignal/shared for the core logic.
 * - implements a minimum candle threshold (MIN_CANDLES) to ensure statistical validity.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import {
  analyzeWyckoff,
  DEFAULT_WYCKOFF_CONFIG,
  type WyckoffAnalysis,
  type WyckoffConfig,
} from "@0xsignal/shared";

interface UseWyckoffWorkerProps {
  data: ChartDataPoint[];
  enabled: boolean;
  config?: Partial<WyckoffConfig>;
}

interface UseWyckoffWorkerResult {
  analysis: WyckoffAnalysis | null;
  isLoading: boolean;
  error: string | null;
}

const MIN_CANDLES = 30;

export function useWyckoffWorker({
  data,
  enabled,
  config,
}: UseWyckoffWorkerProps): UseWyckoffWorkerResult {
  const [analysis, setAnalysis] = useState<WyckoffAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const analyze = useCallback(async () => {
    if (!enabled || data.length < MIN_CANDLES) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      const mergedConfig = { ...DEFAULT_WYCKOFF_CONFIG, ...config };
      const result = analyzeWyckoff(data, mergedConfig);
      if (!abortControllerRef.current.signal.aborted) {
        setAnalysis(result);
        setError(null);
      }
    } catch (err) {
      if (!abortControllerRef.current.signal.aborted) {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setAnalysis(null);
      }
    } finally {
      if (!abortControllerRef.current.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [data, enabled, config]);

  useEffect(() => {
    if (enabled && data.length >= MIN_CANDLES) {
      analyze();
    }
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [analyze, enabled, data.length]);

  useEffect(() => {
    if (!enabled) {
      setAnalysis(null);
      setError(null);
    }
  }, [enabled]);

  return { analysis, isLoading, error };
}
