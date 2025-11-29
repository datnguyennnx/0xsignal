import { useRef, useCallback, useEffect } from "react";
export const useIndicatorWorker = () => {
  const workerRef = useRef(null);
  const pendingRequests = useRef(new Map());
  useEffect(() => {
    workerRef.current = new Worker(new URL("./indicator-worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current.onmessage = (event) => {
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
  const calculate = useCallback((type, data) => {
    return new Promise((resolve) => {
      if (!workerRef.current) {
        console.error("Worker not initialized");
        resolve(null);
        return;
      }
      const id = `${type}-${Date.now()}-${Math.random()}`;
      pendingRequests.current.set(id, resolve);
      const request = { id, type, data };
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
//# sourceMappingURL=use-indicator-worker.js.map
