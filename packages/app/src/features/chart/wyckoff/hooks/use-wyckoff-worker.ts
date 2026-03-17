import { useState, useEffect, useRef, useCallback } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import type { WyckoffAnalysisResult, WyckoffConfig } from "../workers/wyckoff-worker";
import { workerPool } from "../../core/worker-pool";

interface UseWyckoffWorkerProps {
  data: ChartDataPoint[];
  enabled: boolean;
  config?: Partial<WyckoffConfig>;
}

interface UseWyckoffWorkerResult {
  analysis: WyckoffAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
}

const MIN_CANDLES = 30;

export function useWyckoffWorker({
  data,
  enabled,
  config,
}: UseWyckoffWorkerProps): UseWyckoffWorkerResult {
  const [analysis, setAnalysis] = useState<WyckoffAnalysisResult | null>(null);
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
      const result = await workerPool.executeWyckoff(data, config);
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
