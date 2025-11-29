import { useRef, useCallback, useEffect } from "react";
import type { WorkerRequest, WorkerResponse } from "./indicator-worker";

type IndicatorType = "MACD" | "STOCHASTIC" | "BOLLINGER" | "RSI" | "EMA" | "SMA";

interface UseIndicatorWorkerReturn {
  calculate: <T>(type: IndicatorType, data: any) => Promise<T>;
  terminate: () => void;
}

export const useIndicatorWorker = (): UseIndicatorWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);
  const pendingRequests = useRef<Map<string, (value: any) => void>>(new Map());

  useEffect(() => {
    workerRef.current = new Worker(new URL("./indicator-worker.ts", import.meta.url), {
      type: "module",
    });

    workerRef.current.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, result, error } = event.data;
      const resolve = pendingRequests.current.get(id);

      if (resolve) {
        if (error) {
          console.error(`Worker error for request ${id}:`, error);
          resolve(null);
        } else {
          resolve(result);
        }
        pendingRequests.current.delete(id);
      }
    };

    workerRef.current.onerror = (error) => {
      console.error("Worker error:", error);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const calculate = useCallback(<T>(type: IndicatorType, data: any): Promise<T> => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        console.error("Worker not initialized");
        resolve(null as T);
        return;
      }

      const id = `${type}-${Date.now()}-${Math.random()}`;
      pendingRequests.current.set(id, resolve);

      const request: WorkerRequest = { id, type, data };
      workerRef.current.postMessage(request);
    });
  }, []);

  const terminate = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    pendingRequests.current.clear();
  }, []);

  return { calculate, terminate };
};
