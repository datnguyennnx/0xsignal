type IndicatorType = "MACD" | "STOCHASTIC" | "BOLLINGER" | "RSI" | "EMA" | "SMA";
interface UseIndicatorWorkerReturn {
  calculate: <T>(type: IndicatorType, data: any) => Promise<T>;
  terminate: () => void;
}
export declare const useIndicatorWorker: () => UseIndicatorWorkerReturn;
export {};
//# sourceMappingURL=use-indicator-worker.d.ts.map
