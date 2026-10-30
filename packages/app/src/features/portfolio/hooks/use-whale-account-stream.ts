import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  ClearinghouseState,
  OpenOrder,
  SpotClearinghouseState,
  UserFill,
} from "@0xsignal/shared";
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
} from "@/features/trade/lib/user-stream-default";
import {
  createRestFallbackGate,
  type RestFallbackGate,
} from "@/features/trade/lib/rest-fallback-gate";

interface ChannelStatus {
  /** Hyperliquid confirmed the subscription and the socket is open. */
  readonly live: boolean;
  /** REST may run: the grace window expired, or a confirmed stream dropped. */
  readonly restAllowed: boolean;
}

interface Confirmation {
  readonly user: string;
  readonly confirmed: boolean;
}

interface StreamSubscribe<K extends UserStreamChannel> {
  (user: string, listener: (event: UserStreamEventMap[K]) => void): Promise<UserStreamSubscription>;
}

const subscribeToConnectionState = (onChange: () => void): (() => void) =>
  onUserStreamConnectionStateChange(() => {
    onChange();
  });

const getServerConnectionState = (): UserStreamConnectionState => "idle";

function useWhaleSubscription<K extends UserStreamChannel>(
  user: string,
  subscribe: StreamSubscribe<K>,
  onEvent: (event: UserStreamEventMap[K]) => void,
  connectionState: UserStreamConnectionState,
): boolean {
  const handlerRef = useRef(onEvent);
  useEffect(() => {
    handlerRef.current = onEvent;
  }, [onEvent]);

  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  useEffect(() => {
    let cancelled = false;
    let active: UserStreamSubscription | null = null;

    if (user !== "") {
      subscribe(user, (event) => {
        if (!cancelled) handlerRef.current(event);
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
  }, [user, subscribe]);

  return (
    user !== "" &&
    confirmation !== null &&
    confirmation.user === user &&
    confirmation.confirmed &&
    connectionState === "open"
  );
}

function useWhaleRestFallback(live: boolean, user: string): boolean {
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
    if (user === "") return;
    gateRef.current?.setLive(live);
  }, [user, live]);

  return allowed;
}

function useWhaleChannel<K extends UserStreamChannel>(
  user: string,
  subscribe: StreamSubscribe<K>,
  onEvent: (event: UserStreamEventMap[K]) => void,
  connectionState: UserStreamConnectionState,
): ChannelStatus {
  const live = useWhaleSubscription(user, subscribe, onEvent, connectionState);
  return { live, restAllowed: useWhaleRestFallback(live, user) };
}

/**
 * Live account binding for a third party. The same socket that streams the
 * connected wallet also serves any other address, so a whale page reuses it
 * and only the query cache keys are told apart by the query hooks.
 */
export function useWhaleAccountStream(address: string | undefined) {
  const queryClient = useQueryClient();
  const user = address !== undefined && address !== "" ? address : "";
  const connectionState = useSyncExternalStore(
    subscribeToConnectionState,
    getUserStreamConnectionState,
    getServerConnectionState,
  );

  return {
    clearinghouseState: useWhaleChannel<"clearinghouseState">(
      user,
      subscribeClearinghouseState,
      (event) => {
        queryClient.setQueryData<ClearinghouseState>(
          queryKeys.whales.clearinghouseState(user),
          event.data,
        );
      },
      connectionState,
    ),
    spotState: useWhaleChannel<"spotState">(
      user,
      subscribeSpotState,
      (event) => {
        queryClient.setQueryData<SpotClearinghouseState>(
          queryKeys.whales.spotClearinghouseState(user),
          event.data,
        );
      },
      connectionState,
    ),
    openOrders: useWhaleChannel<"openOrders">(
      user,
      subscribeOpenOrders,
      (event) => {
        queryClient.setQueryData<OpenOrder[]>(queryKeys.whales.openOrders(user), event.data);
      },
      connectionState,
    ),
    userFills: useWhaleChannel<"userFills">(
      user,
      subscribeUserFills,
      (event) => {
        queryClient.setQueryData<UserFill[]>(queryKeys.whales.fills(user), (previous) =>
          mergeUserFills(previous, event),
        );
      },
      connectionState,
    ),
  };
}
