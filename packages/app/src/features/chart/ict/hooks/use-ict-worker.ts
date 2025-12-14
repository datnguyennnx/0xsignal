import { useRef, useCallback, useEffect, useState } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import type {
  ICTWorkerRequest,
  ICTWorkerResponse,
  ICTAnalysisResult,
  ICTConfig,
} from "../workers/ict-worker";

interface UseICTWorkerOptions {
  data: ChartDataPoint[];
  config?: Partial<ICTConfig>;
  enabled?: boolean;
  debounceMs?: number;
}

interface UseICTWorkerResult {
  analysis: ICTAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// Debounce delay to prevent rapid worker calls during data streaming
const DEFAULT_DEBOUNCE_MS = 150;

export const useICTWorker = ({
  data,
  config,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseICTWorkerOptions): UseICTWorkerResult => {
  const workerRef = useRef<Worker | null>(null);
  const latestRequestIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [analysis, setAnalysis] = useState<ICTAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize worker
  useEffect(() => {
    workerRef.current = new Worker(new URL("../workers/ict-worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event: MessageEvent<ICTWorkerResponse>) => {
      const { id, result, error: err } = event.data;

      // Ignore stale responses (newer request already sent)
      if (id !== latestRequestIdRef.current) return;

      if (err) {
        setError(err);
        setAnalysis(null);
      } else if (result) {
        setAnalysis(result);
        setError(null);
      }
      setIsLoading(false);
    };

    workerRef.current.onerror = (err) => {
      console.error("ICT Worker error:", err);
      setError("Worker error");
      setIsLoading(false);
    };

    return () => {
      workerRef.current?.terminate();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      latestRequestIdRef.current = null;
    };
  }, []);

  // Run analysis (immediate, no debounce)
  const runAnalysisImmediate = useCallback(() => {
    if (!workerRef.current || !enabled || data.length < 30) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const id = `ict-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    latestRequestIdRef.current = id;

    const request: ICTWorkerRequest = {
      id,
      type: "ANALYZE_ICT",
      data: { candles: data, config },
    };

    workerRef.current.postMessage(request);
  }, [data, config, enabled]);

  // Debounced analysis trigger
  const runAnalysis = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(runAnalysisImmediate, debounceMs);
  }, [runAnalysisImmediate, debounceMs]);

  // Auto-run on data change (debounced)
  useEffect(() => {
    if (enabled && data.length >= 30) {
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
    refresh: runAnalysisImmediate, // Manual refresh bypasses debounce
  };
};
