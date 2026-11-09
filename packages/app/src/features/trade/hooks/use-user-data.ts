import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClearinghouseState,
  FrontendOpenOrder,
  SpotClearinghouseState,
  UserFill,
} from "@0xsignal/shared";
import { api } from "@/services/api";
import { getHistoricalOrders } from "@/services/hl-rest-client";
import { queryKeys } from "@/lib/query-keys";
import {
  getUserStreamConnectionState,
  mergeUserFills,
  onUserStreamConnectionStateChange,
  reportUserStreamFailure,
  subscribeClearinghouseState,
  subscribeOpenOrders,
  subscribeSpotState,
  subscribeUserFills,
  type UserStreamChannel,
  type UserStreamConnectionState,
  type UserStreamEventMap,
  type UserStreamSubscription,
} from "../lib/user-stream-default";
import { createRestFallbackGate, type RestFallbackGate } from "../lib/rest-fallback-gate";
import {
  markUserDataWsWrite,
  resolveUserDataRestResult,
  userRestRefetchInterval,
} from "./user-query-race";
import { useUserQueryGate } from "./use-user-query-gate";

interface UserStreamSubscribe<K extends UserStreamChannel> {
  (user: string, listener: (event: UserStreamEventMap[K]) => void): Promise<UserStreamSubscription>;
}

const subscribeToConnectionState = (onChange: () => void): (() => void) =>
  onUserStreamConnectionStateChange(() => {
    onChange();
  });

const getServerConnectionState = (): UserStreamConnectionState => "idle";

interface StreamConfirmation {
  readonly user: string;
  readonly confirmed: boolean;
}

/**
 * Live stream binding. REST keeps polling until Hyperliquid confirms the
 * subscription; once live, the query stops polling and the stream owns state.
 * A disconnect flips `live` back so REST resumes.
 */
function useUserStream<K extends UserStreamChannel>(
  subscribe: UserStreamSubscribe<K>,
  user: string,
  enabled: boolean,
  listener: (event: UserStreamEventMap[K]) => void,
): boolean {
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);

  const [confirmation, setConfirmation] = useState<StreamConfirmation | null>(null);
  const connectionState = useSyncExternalStore(
    subscribeToConnectionState,
    getUserStreamConnectionState,
    getServerConnectionState,
  );

  useEffect(() => {
    let cancelled = false;
    let active: UserStreamSubscription | null = null;

    if (enabled && user !== "") {
      subscribe(user, (event) => {
        if (!cancelled) listenerRef.current(event);
      })
        .then((subscription) => {
          if (cancelled) {
            subscription.unsubscribe();
            return false;
          }
          active = subscription;
          setConfirmation({ user, confirmed: true });
          return true;
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setConfirmation({ user, confirmed: false });
            reportUserStreamFailure(
              "subscribe-rejected",
              error instanceof Error ? error.message : String(error),
            );
          }
          return false;
        });
    }

    return () => {
      cancelled = true;
      active?.unsubscribe();
    };
  }, [enabled, user, subscribe]);

  return (
    enabled &&
    user !== "" &&
    confirmation !== null &&
    confirmation.user === user &&
    confirmation.confirmed &&
    connectionState === "open"
  );
}

/**
 * REST stays closed while the stream is racing to open, opens once the grace
 * window expires with no confirmation, and opens immediately after a confirmed
 * stream disconnects so an outage never leaves consumers on stale data.
 */
function useUserRestFallback(live: boolean, enabled: boolean, user: string): boolean {
  const [allowed, setAllowed] = useState(false);
  const gateRef = useRef<RestFallbackGate | null>(null);

  useEffect(() => {
    const gate = createRestFallbackGate(() => {
      setAllowed(true);
    });
    gateRef.current = gate;
    return () => {
      gate.dispose();
      gateRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!enabled || user === "") return;
    gateRef.current?.setLive(live);
  }, [enabled, user, live]);

  return allowed;
}

export function useClearinghouseState(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  const queryClient = useQueryClient();
  const key = queryKeys.user.clearinghouseState(gate.walletAddress);

  const live = useUserStream<"clearinghouseState">(
    subscribeClearinghouseState,
    gate.walletAddress,
    gate.enabled,
    (event) => {
      markUserDataWsWrite(key);
      queryClient.setQueryData(key, event.data);
    },
  );
  const restAllowed = useUserRestFallback(live, gate.enabled, gate.walletAddress);

  return useQuery({
    queryKey: key,
    queryFn: async ({ queryKey }) => {
      const startedAt = Date.now();
      const data = await api.getUserClearinghouseState(gate.walletAddress);
      return resolveUserDataRestResult(queryKey, startedAt, data, () =>
        queryClient.getQueryData<ClearinghouseState>(queryKey),
      );
    },
    enabled: gate.enabled && restAllowed,
    staleTime: live ? Infinity : 10 * 1000,
    refetchOnWindowFocus: !live,
    refetchInterval: () => userRestRefetchInterval(live),
  });
}

export function useSpotClearinghouseState(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  const queryClient = useQueryClient();
  const key = queryKeys.user.spotClearinghouseState(gate.walletAddress);

  const live = useUserStream<"spotState">(
    subscribeSpotState,
    gate.walletAddress,
    gate.enabled,
    (event) => {
      markUserDataWsWrite(key);
      queryClient.setQueryData<SpotClearinghouseState>(key, event.data);
    },
  );
  const restAllowed = useUserRestFallback(live, gate.enabled, gate.walletAddress);

  return useQuery({
    queryKey: key,
    queryFn: async ({ queryKey }) => {
      const startedAt = Date.now();
      const data = await api.getUserSpotClearinghouseState(gate.walletAddress);
      return resolveUserDataRestResult(queryKey, startedAt, data, () =>
        queryClient.getQueryData<SpotClearinghouseState>(queryKey),
      );
    },
    enabled: gate.enabled && restAllowed,
    staleTime: live ? Infinity : 10 * 1000,
    refetchOnWindowFocus: !live,
    refetchInterval: () => userRestRefetchInterval(live),
  });
}

export function useOpenOrders(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  const queryClient = useQueryClient();
  const key = queryKeys.user.openOrders(gate.walletAddress);

  const live = useUserStream<"openOrders">(
    subscribeOpenOrders,
    gate.walletAddress,
    gate.enabled,
    (event) => {
      markUserDataWsWrite(key);
      queryClient.setQueryData<FrontendOpenOrder[]>(key, event.data);
    },
  );
  const restAllowed = useUserRestFallback(live, gate.enabled, gate.walletAddress);

  return useQuery({
    queryKey: key,
    queryFn: async ({ queryKey }) => {
      const startedAt = Date.now();
      const data = await api.getUserFrontendOpenOrders(gate.walletAddress);
      return resolveUserDataRestResult(queryKey, startedAt, data, () =>
        queryClient.getQueryData<FrontendOpenOrder[]>(queryKey),
      );
    },
    enabled: gate.enabled && restAllowed,
    staleTime: live ? Infinity : 30 * 1000,
    refetchOnWindowFocus: !live,
    refetchInterval: () => userRestRefetchInterval(live),
  });
}

export function useHistoricalOrders(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  return useQuery({
    queryKey: queryKeys.user.historicalOrders(gate.walletAddress),
    queryFn: () => getHistoricalOrders(gate.walletAddress),
    enabled: gate.enabled,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserFills(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  const queryClient = useQueryClient();
  const key = queryKeys.user.fills(gate.walletAddress);

  const live = useUserStream<"userFills">(
    subscribeUserFills,
    gate.walletAddress,
    gate.enabled,
    (event) => {
      markUserDataWsWrite(key);
      queryClient.setQueryData<UserFill[]>(key, (previous) => mergeUserFills(previous, event));
    },
  );
  const restAllowed = useUserRestFallback(live, gate.enabled, gate.walletAddress);

  return useQuery({
    queryKey: key,
    queryFn: async ({ queryKey }) => {
      const startedAt = Date.now();
      const data = await api.getUserFills(gate.walletAddress);
      return resolveUserDataRestResult(queryKey, startedAt, data, () =>
        queryClient.getQueryData<UserFill[]>(queryKey),
      );
    },
    enabled: gate.enabled && restAllowed,
    staleTime: live ? Infinity : 30 * 1000,
    refetchOnWindowFocus: !live,
    refetchInterval: () => userRestRefetchInterval(live),
  });
}
