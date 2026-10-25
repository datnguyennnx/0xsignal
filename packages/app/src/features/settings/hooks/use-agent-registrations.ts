import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { api } from "@/services/api";

export function useAgentRegistrations(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.user.agentRegistrations(),
    queryFn: () => api.listAgentRegistrations(),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
