/**
 * React hook for ICT analysis using Web Worker
 * Offloads heavy pattern detection to background thread
 */

import { useRef, useCallback, useEffect, useState } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import type {
  ICTWorkerRequest,
  ICTWorkerResponse,
  ICTAnalysisResult,
  ICTConfig,
} from "./ict-worker";

interface UseICTWorkerOptions {
  data: ChartDataPoint[];
  config?: Partial<ICTConfig>;
  enabled?: boolean;
}

interface UseICTWorkerResult {
  analysis: ICTAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export const useICTWorker = ({
  data,
  config,
  enabled = true,
}: UseICTWorkerOptions): UseICTWorkerResult => {
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<string, (res: ICTWorkerResponse) => void>>(new Map());
  const [analysis, setAnalysis] = useState<ICTAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize worker
  useEffect(() => {
    workerRef.current = new Worker(new URL("./ict-worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event: MessageEvent<ICTWorkerResponse>) => {
      const { id, result, error: err } = event.data;
      const resolve = pendingRef.current.get(id);

      if (resolve) {
        resolve(event.data);
        pendingRef.current.delete(id);
      }

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
      pendingRef.current.clear();
    };
  }, []);

  // Run analysis
  const runAnalysis = useCallback(() => {
    if (!workerRef.current || !enabled || data.length < 30) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const id = `ict-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const request: ICTWorkerRequest = {
      id,
      type: "ANALYZE_ICT",
      data: { candles: data, config },
    };

    pendingRef.current.set(id, () => {});
    workerRef.current.postMessage(request);
  }, [data, config, enabled]);

  // Auto-run on data change
  useEffect(() => {
    if (enabled && data.length >= 30) {
      runAnalysis();
    }
  }, [data, enabled, runAnalysis]);

  return {
    analysis,
    isLoading,
    error,
    refresh: runAnalysis,
  };
};
