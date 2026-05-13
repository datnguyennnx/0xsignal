/**
 * @overview ICT analysis hook — thin wrapper over shared useAnalysisWorker.
 */
import type { ChartDataPoint } from "@0xsignal/shared";
import { analyzeICT, DEFAULT_ICT_CONFIG, type ICTAnalysis, type ICTConfig } from "@0xsignal/shared";
import { useAnalysisWorker } from "../shared";

interface UseICTWorkerOptions {
  data: ChartDataPoint[];
  config?: Partial<ICTConfig>;
  enabled?: boolean;
}

export function useICTWorker({ data, config, enabled = true }: UseICTWorkerOptions) {
  return useAnalysisWorker<ICTConfig, ICTAnalysis>({
    data,
    enabled,
    config,
    defaultConfig: DEFAULT_ICT_CONFIG,
    analyzeFn: analyzeICT,
    minCandles: 30,
    debounceMs: 150,
  });
}
