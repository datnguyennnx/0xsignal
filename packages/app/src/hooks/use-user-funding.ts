import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";

export function useUserFunding(startTime?: number, endTime?: number, enabled: boolean = true) {
  const { address: walletAddress } = useConnection();
  return useQuery({
    queryKey: queryKeys.user.userFunding(walletAddress!, startTime, endTime),
    queryFn: () => api.getUserFunding(walletAddress!, startTime, endTime),
    enabled: enabled && walletAddress !== undefined,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
