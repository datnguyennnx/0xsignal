import { useInfiniteQuery } from "@tanstack/react-query";
import type { WhalePosition, WhalePositionsQuery } from "@0xsignal/shared";

import { queryKeys } from "@/lib/query-keys";
import { getPositions } from "@/services/api/whales";

export const WHALE_POSITIONS_REFETCH_INTERVAL = 30_000;

/** Four pages (200 rows) bound the fetched set; the table renders only the visible window. */
export const MAX_WHALE_POSITION_PAGES = 4;

export interface WhalePositionsPageLike {
  readonly positions: readonly WhalePosition[];
}

/**
 * A row's identity is the wallet, coin and entry time; a cursor refresh can
 * return the same position in two adjacent pages, which would duplicate it.
 */
export function whalePositionRowKey(position: WhalePosition): string {
  return `${position.userAddress}-${position.coin}-${position.entryTime}`;
}

/** Flatten pages while keeping the first occurrence of every position row. */
export function dedupeWhalePositions(
  pages: ReadonlyArray<WhalePositionsPageLike> | undefined,
): WhalePosition[] {
  if (pages === undefined) return [];

  const seen = new Set<string>();
  const rows: WhalePosition[] = [];
  for (const page of pages) {
    for (const position of page.positions) {
      const key = whalePositionRowKey(position);
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(position);
    }
  }
  return rows;
}

interface WhalePositionsRefetchState {
  readonly state?:
    | {
        readonly data?:
          | {
              readonly pages?: readonly unknown[];
            }
          | undefined;
      }
    | undefined;
}

/**
 * Poll only the single-page snapshot. Once a second page is mounted a refresh
 * would rewrite every retained page (and `maxPages` would shift rows), so the
 * loaded table stays on the user's current cursor until they reload.
 */
export function whalePositionsRefetchInterval(query?: WhalePositionsRefetchState): number | false {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;

  const pageCount = query?.state?.data?.pages?.length ?? 0;
  if (pageCount > 1) return false;

  return WHALE_POSITIONS_REFETCH_INTERVAL;
}

export function whalePositionsQueryOptions(query: WhalePositionsQuery = {}) {
  return {
    queryKey: queryKeys.whales.positions(query),
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getPositions(pageParam === null ? query : { ...query, cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: Awaited<ReturnType<typeof getPositions>>) =>
      lastPage.nextCursor ?? null,
    maxPages: MAX_WHALE_POSITION_PAGES,
    refetchInterval: whalePositionsRefetchInterval,
  };
}

export function useWhalePositions(query: WhalePositionsQuery = {}) {
  return useInfiniteQuery(whalePositionsQueryOptions(query));
}
