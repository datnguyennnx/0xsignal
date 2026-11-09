import { useQuery } from "@tanstack/react-query";

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
  return useQuery(agentRegistrationsQueryOptions(address, isAuthenticated));
}
