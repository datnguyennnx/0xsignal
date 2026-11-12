import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { InfoClient, Transport } from "@0xsignal/sdk-hyperliquid";
import type { PredictedFundingsInfoResponse } from "@0xsignal/sdk-hyperliquid/info";
import { queryKeys } from "@/lib/query-keys";
import { toCountdown } from "../utils/format";

const COUNTDOWN_TICK_MS = 1_000;
const FUNDING_HOUR_MS = 3_600_000;
const PREDICTED_FUNDINGS_REFRESH_MS = 60_000;
const INFO_URL = "https://api.hyperliquid.xyz";
const INFO_TIMEOUT_MS = 10_000;

const formatCountdown = toCountdown;

/** The next UTC hour boundary, independent of the viewer's local time zone. */
export function nextUtcHourMs(nowMs: number): number {
  const boundary = Math.ceil(nowMs / FUNDING_HOUR_MS) * FUNDING_HOUR_MS;
  return boundary <= nowMs ? boundary + FUNDING_HOUR_MS : boundary;
}

export function selectNextFundingTime(
  data: PredictedFundingsInfoResponse,
  coin: string,
): number | null {
  const target = coin.toUpperCase();
  const entry = data.find(([name]) => name.toUpperCase() === target);
  if (entry === undefined) return null;
  for (const [, funding] of entry[1]) {
    if (
      funding !== null &&
      Number.isFinite(funding.nextFundingTime) &&
      funding.nextFundingTime > 0
    ) {
      return funding.nextFundingTime;
    }
  }
  return null;
}

let infoClient: InfoClient | null = null;

const getInfoClient = (): InfoClient =>
  (infoClient ??= new InfoClient(
    new Transport({ baseUrl: INFO_URL, timeoutMs: INFO_TIMEOUT_MS, retries: 0 }),
  ));

const nextFundingQueryKey = (coin: string) => queryKeys.asset.nextFunding(coin);

/** The funding epoch is fetched at most once a minute; the countdown only ticks locally. */
export function useNextFundingTime(coin: string): number | null {
  const query = useQuery({
    queryKey: nextFundingQueryKey(coin),
    queryFn: () => getInfoClient().predictedFundings({}),
    enabled: coin !== "",
    staleTime: PREDICTED_FUNDINGS_REFRESH_MS,
    refetchInterval: coin === "" ? false : PREDICTED_FUNDINGS_REFRESH_MS,
    refetchOnWindowFocus: false,
    select: (data: PredictedFundingsInfoResponse) => selectNextFundingTime(data, coin),
  });

  return query.data ?? null;
}

export function useFundingCountdown(nextFundingMs: number | null | undefined): string {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, COUNTDOWN_TICK_MS);
    return () => {
      clearInterval(id);
    };
  }, []);

  return formatCountdown((nextFundingMs ?? nextUtcHourMs(nowMs)) - nowMs);
}
