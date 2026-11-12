import { useQuery } from "@tanstack/react-query";

import { toAsyncState } from "@/lib/async-state";
import { queryKeys } from "@/lib/query-keys";
import { listAgentRegistrations } from "@/services/api/credentials";

/** Registrations are scoped to the signed-in account's address, so the key carries it. */
export function agentRegistrationsQueryOptions(address: string, isAuthenticated: boolean) {
  return {
    queryKey: queryKeys.user.agentRegistrations(address),
    queryFn: () => listAgentRegistrations(),
    enabled: address !== "" && isAuthenticated,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  };
}

export function useAgentRegistrations(address: string, isAuthenticated: boolean) {
  const result = useQuery(agentRegistrationsQueryOptions(address, isAuthenticated));

  const state = toAsyncState({
    enabled: address !== "" && isAuthenticated,
    isPending: result.isPending,
    isFetching: result.isFetching,
    isError: result.isError,
    error: result.error,
    data: result.data,
    isEmpty: (data) => data.length === 0,
    emptyReason: "first-use",
  });

  return { ...result, state };
}
