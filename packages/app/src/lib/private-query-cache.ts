import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

/**
 * Auth-scoped query data is private to the signed-in account. Drop it whenever the
 * session ends so a shared device never shows the previous account's data: wallet
 * views stay private even though they are fetched from public endpoints.
 */
export function clearPrivateQueries(): void {
  queryClient.removeQueries({ queryKey: queryKeys.user.all });
  queryClient.removeQueries({ queryKey: queryKeys.whales.all });
}
