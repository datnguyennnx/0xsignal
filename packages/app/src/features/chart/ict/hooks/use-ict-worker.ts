import { useRef, useCallback, useEffect, useState } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { analyzeICT, DEFAULT_ICT_CONFIG, type ICTAnalysis, type ICTConfig } from "@0xsignal/shared";

interface UseICTWorkerOptions {
  data: ChartDataPoint[];
  config?: Partial<ICTConfig>;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseICTWorkerResult {
  analysis: ICTAnalysis | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const DEFAULT_DEBOUNCE_MS = 150;
const MIN_CANDLES = 30;

export const useICTWorker = ({
  data,
  config,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseICTWorkerOptions): UseICTWorkerResult => {
  const latestRequestIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [analysis, setAnalysis] = useState<ICTAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysisImmediate = useCallback(async () => {
    if (!enabled || data.length < MIN_CANDLES) return;

    setIsLoading(true);
    setError(null);

    const id = `ict-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    latestRequestIdRef.current = id;

    try {
      const mergedConfig = { ...DEFAULT_ICT_CONFIG, ...config };
      const result = analyzeICT(data, mergedConfig);
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
  }, [data, config, enabled]);

  const runAnalysis = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(runAnalysisImmediate, debounceMs);
  }, [runAnalysisImmediate, debounceMs]);

  useEffect(() => {
    if (enabled && data.length >= MIN_CANDLES) {
      runAnalysis();
    }
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [data, enabled, runAnalysis]);

  return {
    analysis,
    isLoading,
    error,
    refresh: runAnalysisImmediate,
  };
};
