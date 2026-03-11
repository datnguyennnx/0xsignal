import { useQuery, useMutation } from "@tanstack/react-query";
import { ai, type ChartContext, type TradeContext } from "@/services/ai";
import { queryKeys } from "@/lib/query/query-keys";
import { getQueryOptions } from "@/lib/query/client";

// Lấy danh sách AI models
export function useModels() {
  return useQuery({
    queryKey: queryKeys.ai.models(),
    queryFn: () => ai.getModels(),
    ...getQueryOptions.models,
  });
}

// Phân tích chart bằng AI - không retry tự động
export function useAIAnalysis(context: ChartContext | null) {
  return useQuery({
    queryKey: queryKeys.ai.analysis(context?.symbol || "", context?.timeframe),
    queryFn: () => {
      if (!context) throw new Error("Context required");
      return ai.analyzeChart(context);
    },
    enabled: !!context && context.priceData.length > 0,
    ...getQueryOptions.ai,
  });
}

// Mutation: Lấy recommendation từ AI
export function useAIRecommendation() {
  return useMutation({
    mutationFn: ({ query, context }: { query: string; context: TradeContext }) =>
      ai.getRecommendation(query, context),
    retry: 0,
  });
}

// Mutation: Xóa cache AI
export function useClearAICache() {
  return useMutation({
    mutationFn: ({ symbol, timeframe }: { symbol: string; timeframe: string }) =>
      ai.clearCache(symbol, timeframe),
    retry: 0,
  });
}
