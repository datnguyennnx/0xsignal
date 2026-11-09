import { useQuery } from "@tanstack/react-query";
import { getUserFunding } from "@/services/hl-rest-client";
import { queryKeys } from "@/lib/query-keys";
import { useOwnAddress } from "@/hooks/use-effective-address";

/** An empty address would poll `GET funding` for a wallet that cannot exist. */
export function isUserFundingEnabled(ownAddress: string | undefined, enabled: boolean): boolean {
  return enabled && ownAddress !== undefined && ownAddress !== "";
}

export function useUserFunding(startTime?: number, endTime?: number, enabled: boolean = true) {
  const ownAddress = useOwnAddress();
  const address = ownAddress ?? "";
  return useQuery({
    queryKey: queryKeys.user.userFunding(address, startTime, endTime),
    queryFn: () => getUserFunding(address, startTime, endTime),
    enabled: isUserFundingEnabled(ownAddress, enabled),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
