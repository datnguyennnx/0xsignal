import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type {
  ClearinghouseState,
  OpenOrder,
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

const subscribeToConnectionState = (onChange: () => void): (() => void) =>
  onUserStreamConnectionStateChange(() => {
    onChange();
  });

const getServerConnectionState = (): UserStreamConnectionState => "idle";

type ChannelStatus = "pending" | "confirmed" | "failed";

interface ChannelBinding {
  refCount: number;
  status: ChannelStatus;
  subscription: Promise<UserStreamSubscription> | null;
}

interface UserStreamEntry {
  refCount: number;
  readonly queryClient: QueryClient;
  readonly channels: Map<UserStreamChannel, ChannelBinding>;
}

interface UserChannelDefinition<K extends UserStreamChannel> {
  readonly subscribe: (
    user: string,
    listener: (event: UserStreamEventMap[K]) => void,
  ) => Promise<UserStreamSubscription>;
  readonly write: (queryClient: QueryClient, user: string, event: UserStreamEventMap[K]) => void;
}

const channelDefinitions = {
  clearinghouseState: {
    subscribe: subscribeClearinghouseState,
    write: (queryClient, user, event) => {
      const key = queryKeys.user.clearinghouseState(user);
      markUserDataWsWrite(key);
      queryClient.setQueryData(key, event.data);
    },
  },
  spotState: {
    subscribe: subscribeSpotState,
    write: (queryClient, user, event) => {
      const key = queryKeys.user.spotClearinghouseState(user);
      markUserDataWsWrite(key);
      queryClient.setQueryData<SpotClearinghouseState>(key, event.data);
    },
  },
  openOrders: {
    subscribe: subscribeOpenOrders,
    write: (queryClient, user, event) => {
      const key = queryKeys.user.openOrders(user);
      markUserDataWsWrite(key);
      queryClient.setQueryData<readonly OpenOrder[]>(key, event.data);
    },
  },
  userFills: {
    subscribe: subscribeUserFills,
    write: (queryClient, user, event) => {
      const key = queryKeys.user.fills(user);
      markUserDataWsWrite(key);
      queryClient.setQueryData<UserFill[]>(key, (previous) => mergeUserFills(previous, event));
    },
  },
} satisfies { [K in UserStreamChannel]: UserChannelDefinition<K> };

const userStreamRegistry = new Map<string, UserStreamEntry>();
const registryListeners = new Set<() => void>();
let registryVersion = 0;

const notifyRegistry = (): void => {
  registryVersion += 1;
  for (const listener of registryListeners) listener();
};

const subscribeRegistry = (listener: () => void): (() => void) => {
  registryListeners.add(listener);
  return () => {
    registryListeners.delete(listener);
  };
};

const readChannelStatus = (user: string, channel: UserStreamChannel): ChannelStatus =>
  userStreamRegistry.get(user)?.channels.get(channel)?.status ?? "pending";

function startChannel(
  entry: UserStreamEntry,
  channel: UserStreamChannel,
  user: string,
): Promise<UserStreamSubscription> {
  switch (channel) {
    case "clearinghouseState":
      return subscribeClearinghouseState(user, (event) => {
        channelDefinitions.clearinghouseState.write(entry.queryClient, user, event);
      });
    case "spotState":
      return subscribeSpotState(user, (event) => {
        channelDefinitions.spotState.write(entry.queryClient, user, event);
      });
    case "openOrders":
      return subscribeOpenOrders(user, (event) => {
        channelDefinitions.openOrders.write(entry.queryClient, user, event);
      });
    case "userFills":
      return subscribeUserFills(user, (event) => {
        channelDefinitions.userFills.write(entry.queryClient, user, event);
      });
    default:
      return Promise.reject(new Error(`Unhandled user stream channel: ${String(channel)}`));
  }
}

function releaseChannel(entry: UserStreamEntry, channel: UserStreamChannel): void {
  const binding = entry.channels.get(channel);
  if (binding === undefined) return;
  binding.refCount -= 1;
  if (binding.refCount > 0) return;

  entry.channels.delete(channel);
  const subscription = binding.subscription;
  binding.subscription = null;
  if (subscription !== null) {
    void subscription
      .then((active) => {
        active.unsubscribe();
        return null;
      })
      .catch(() => null);
  }
}

function acquireUserChannel(
  user: string,
  channel: UserStreamChannel,
  queryClient: QueryClient,
): () => void {
  if (user === "") return () => {};

  let entry = userStreamRegistry.get(user);
  if (entry === undefined) {
    entry = { refCount: 0, queryClient, channels: new Map() };
    userStreamRegistry.set(user, entry);
  }
  entry.refCount += 1;

  const binding = entry.channels.get(channel);
  if (binding === undefined) {
    const created: ChannelBinding = { refCount: 1, status: "pending", subscription: null };
    entry.channels.set(channel, created);
    const subscription = startChannel(entry, channel, user);
    created.subscription = subscription;
    subscription
      .then(() => {
        if (created.status === "pending") {
          created.status = "confirmed";
          notifyRegistry();
        }
        return null;
      })
      .catch((error: unknown) => {
        if (created.status === "pending") {
          created.status = "failed";
          notifyRegistry();
          reportUserStreamFailure(
            "subscribe-rejected",
            error instanceof Error ? error.message : String(error),
          );
        }
      });
  } else {
    binding.refCount += 1;
  }

  notifyRegistry();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    releaseChannel(entry, channel);
    entry.refCount -= 1;
    if (entry.refCount > 0) {
      notifyRegistry();
      return;
    }
    for (const remaining of entry.channels.keys()) {
      releaseChannel(entry, remaining);
    }
    userStreamRegistry.delete(user);
    notifyRegistry();
  };
}

function useUserStreamChannel(user: string, channel: UserStreamChannel, enabled: boolean): boolean {
  const queryClient = useQueryClient();
  const connectionState = useSyncExternalStore(
    subscribeToConnectionState,
    getUserStreamConnectionState,
    getServerConnectionState,
  );

  useEffect(() => {
    if (!enabled || user === "") return () => {};
    return acquireUserChannel(user, channel, queryClient);
  }, [enabled, user, channel, queryClient]);

  const status = useSyncExternalStore(
    subscribeRegistry,
    () => (enabled && user !== "" ? readChannelStatus(user, channel) : "pending"),
    () => "pending",
  );

  return enabled && user !== "" && status === "confirmed" && connectionState === "open";
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

  const live = useUserStreamChannel(gate.walletAddress, "clearinghouseState", gate.enabled);
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

  const live = useUserStreamChannel(gate.walletAddress, "spotState", gate.enabled);
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

  const live = useUserStreamChannel(gate.walletAddress, "openOrders", gate.enabled);
  const restAllowed = useUserRestFallback(live, gate.enabled, gate.walletAddress);

  return useQuery({
    queryKey: key,
    queryFn: async ({ queryKey }) => {
      const startedAt = Date.now();
      const data: readonly OpenOrder[] = await api.getUserFrontendOpenOrders(gate.walletAddress);
      return resolveUserDataRestResult(queryKey, startedAt, data, () =>
        queryClient.getQueryData<readonly OpenOrder[]>(queryKey),
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

  const live = useUserStreamChannel(gate.walletAddress, "userFills", gate.enabled);
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
