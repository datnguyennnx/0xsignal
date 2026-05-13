/**
 * @overview Wyckoff analysis hook — thin wrapper over shared useAnalysisWorker.
 */
import type { ChartDataPoint } from "@0xsignal/shared";
import { analyzeWyckoff, type WyckoffAnalysis, type WyckoffConfig } from "@0xsignal/shared";
import { useAnalysisWorker } from "../shared";
import { DEFAULT_WYCKOFF_CONFIG } from "@0xsignal/shared";

interface UseWyckoffWorkerProps {
  data: ChartDataPoint[];
  enabled: boolean;
  config?: Partial<WyckoffConfig>;
}

export function useWyckoffWorker({ data, enabled, config }: UseWyckoffWorkerProps) {
  return useAnalysisWorker<WyckoffConfig, WyckoffAnalysis>({
    data,
    enabled,
    config,
    defaultConfig: DEFAULT_WYCKOFF_CONFIG,
    analyzeFn: analyzeWyckoff,
    minCandles: 30,
    debounceMs: 0, // no debounce — Wyckoff recomputes eagerly
  });
}
