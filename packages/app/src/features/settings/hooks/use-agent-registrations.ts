import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { listAgentRegistrations } from "@/services/api/credentials";

export function useAgentRegistrations(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.user.agentRegistrations(),
    queryFn: () => listAgentRegistrations(),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
