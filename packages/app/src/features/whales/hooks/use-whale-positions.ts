import { useInfiniteQuery } from "@tanstack/react-query";
import type { WhalePositionsQuery } from "@0xsignal/shared";

import { queryKeys } from "@/lib/query-keys";
import { getPositions } from "@/services/api/whales";

const POSITIONS_REFETCH_INTERVAL = 30_000;

export function useWhalePositions(query: WhalePositionsQuery = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.whales.positions(query),
    queryFn: ({ pageParam }) =>
      getPositions(pageParam === null ? query : { ...query, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? null,
    refetchInterval: POSITIONS_REFETCH_INTERVAL,
  });
}
