import { useQuery } from "@tanstack/react-query";
import { getUserFunding } from "@/services/hl-rest-client";
import { queryKeys } from "@/lib/query-keys";
import { useOwnAddress } from "@/hooks/use-effective-address";

export function useUserFunding(startTime?: number, endTime?: number, enabled: boolean = true) {
  const ownAddress = useOwnAddress();
  const address = ownAddress ?? "";
  return useQuery({
    queryKey: queryKeys.user.userFunding(address, startTime, endTime),
    queryFn: () => getUserFunding(address, startTime, endTime),
    enabled: enabled && ownAddress !== undefined,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
