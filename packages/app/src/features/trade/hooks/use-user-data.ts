import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { FrontendOpenOrder, SpotClearinghouseState, UserFill } from "@0xsignal/shared";
import { api } from "@/services/api";
import { getHistoricalOrders } from "@/services/hl-rest-client";
import { queryKeys } from "@/lib/query-keys";
import { useOwnAddress } from "@/hooks/use-effective-address";
import { useAuthStore } from "@/stores/use-auth-store";
import {
  getUserStreamConnectionState,
  mergeUserFills,
  onUserStreamConnectionStateChange,
  subscribeClearinghouseState,
  subscribeOpenOrders,
  subscribeSpotState,
  subscribeUserFills,
  type UserStreamChannel,
  type UserStreamConnectionState,
  type UserStreamEventMap,
  type UserStreamSubscription,
} from "../lib/user-stream-client";

const isPresent = (value: string | null | undefined): boolean =>
  value !== null && value !== undefined && value !== "";

/** User data is both wallet-scoped and auth-scoped; either missing half means no request. */
function useUserQueryGate(enabled: boolean) {
  const ownAddress = useOwnAddress();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return {
    walletAddress: ownAddress ?? "",
    enabled: enabled && isAuthenticated && isPresent(ownAddress),
  };
}

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
        .catch(() => {
          if (!cancelled) setConfirmation({ user, confirmed: false });
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

export function useClearinghouseState(enabled: boolean = true) {
  const gate = useUserQueryGate(enabled);
  const queryClient = useQueryClient();
  const key = queryKeys.user.clearinghouseState(gate.walletAddress);

  const live = useUserStream<"clearinghouseState">(
    subscribeClearinghouseState,
    gate.walletAddress,
    gate.enabled,
    (event) => {
      queryClient.setQueryData(key, event.data);
    },
  );

  return useQuery({
    queryKey: key,
    queryFn: () => api.getUserClearinghouseState(gate.walletAddress),
    enabled: gate.enabled,
    staleTime: live ? Infinity : 10 * 1000,
    refetchOnWindowFocus: !live,
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
      queryClient.setQueryData<SpotClearinghouseState>(key, event.data);
    },
  );

  return useQuery({
    queryKey: key,
    queryFn: () => api.getUserSpotClearinghouseState(gate.walletAddress),
    enabled: gate.enabled,
    staleTime: live ? Infinity : 10 * 1000,
    refetchOnWindowFocus: !live,
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
      queryClient.setQueryData<FrontendOpenOrder[]>(key, event.data);
    },
  );

  return useQuery({
    queryKey: key,
    queryFn: () => api.getUserFrontendOpenOrders(gate.walletAddress),
    enabled: gate.enabled,
    staleTime: live ? Infinity : 30 * 1000,
    refetchOnWindowFocus: !live,
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
      queryClient.setQueryData<UserFill[]>(key, (previous) => mergeUserFills(previous, event));
    },
  );

  return useQuery({
    queryKey: key,
    queryFn: () => api.getUserFills(gate.walletAddress),
    enabled: gate.enabled,
    staleTime: live ? Infinity : 30 * 1000,
    refetchOnWindowFocus: !live,
  });
}
