/**
 * Web Worker for indicator calculations
 * Offloads heavy computations from main thread for 60fps UI
 */
export interface WorkerRequest {
  id: string;
  type: "MACD" | "STOCHASTIC" | "BOLLINGER" | "RSI" | "EMA" | "SMA";
  data: unknown;
}
export interface WorkerResponse {
  id: string;
  result: unknown;
  error?: string;
}
//# sourceMappingURL=indicator-worker.d.ts.map
