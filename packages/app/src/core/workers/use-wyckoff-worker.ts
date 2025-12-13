import { useState, useEffect, useRef, useCallback } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import type {
  WyckoffAnalysisResult,
  WyckoffWorkerRequest,
  WyckoffWorkerResponse,
  WyckoffConfig,
} from "./wyckoff-worker";

interface UseWyckoffWorkerProps {
  data: ChartDataPoint[];
  enabled: boolean;
  config?: Partial<WyckoffConfig>;
}

interface UseWyckoffWorkerResult {
  analysis: WyckoffAnalysisResult | null;
  loading: boolean;
  error: string | null;
}

export function useWyckoffWorker({
  data,
  enabled,
  config,
}: UseWyckoffWorkerProps): UseWyckoffWorkerResult {
  const [analysis, setAnalysis] = useState<WyckoffAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    workerRef.current = new Worker(new URL("./wyckoff-worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event: MessageEvent<WyckoffWorkerResponse>) => {
      const { id, result, error: workerError } = event.data;

      if (parseInt(id, 10) !== requestIdRef.current) return;

      setLoading(false);

      if (workerError) {
        setError(workerError);
        setAnalysis(null);
      } else {
        setError(null);
        setAnalysis(result);
      }
    };

    workerRef.current.onerror = (err) => {
      setLoading(false);
      setError(err.message);
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [enabled]);

  const analyze = useCallback(() => {
    if (!workerRef.current || !enabled || data.length === 0) return;

    requestIdRef.current += 1;
    const id = String(requestIdRef.current);

    setLoading(true);
    setError(null);

    const request: WyckoffWorkerRequest = {
      id,
      type: "ANALYZE_WYCKOFF",
      data: {
        candles: data,
        config,
      },
    };

    workerRef.current.postMessage(request);
  }, [data, enabled, config]);

  useEffect(() => {
    if (enabled && data.length > 0) {
      analyze();
    }
  }, [analyze, enabled, data.length]);

  useEffect(() => {
    if (!enabled) {
      setAnalysis(null);
      setError(null);
    }
  }, [enabled]);

  return { analysis, loading, error };
}
