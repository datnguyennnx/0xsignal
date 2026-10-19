import { useQuery } from "@tanstack/react-query";
import type { WhalePositionsQuery } from "@0xsignal/shared";

import { queryKeys } from "@/lib/query-keys";
import { api } from "@/services/api";

const POSITIONS_REFETCH_INTERVAL = 30_000;

export function useWhalePositions(query: WhalePositionsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.whales.positions(query),
    queryFn: () => api.whales.positions(query),
    refetchInterval: POSITIONS_REFETCH_INTERVAL,
  });
}
