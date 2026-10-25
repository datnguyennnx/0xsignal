/**
 * Cross-tab coordination for the user stream. Hyperliquid caps one IP at ten
 * sockets, so tabs elect a single leader: it owns the upstream socket and
 * broadcasts decoded events to the other tabs over BroadcastChannel. When the
 * leader disappears the remaining tabs re-elect and re-home their subscriptions.
 */

type TabRole = "undecided" | "leader" | "follower";

export interface TabChannel {
  send(message: unknown): void;
  close(): void;
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void): void;
}

export interface RemoteSubscriptionRequest {
  readonly key: string;
  readonly user: string;
  readonly channel: string;
}

export interface TabCoordinatorOptions<E> {
  readonly createChannel: (name: string) => TabChannel;
  readonly tabId: string;
  readonly electionDelayMs: number;
  readonly isEvent: (value: unknown) => value is E;
  readonly onPromote: () => void;
  readonly onDemote: () => void;
  readonly onRemoteSubscribe: (request: RemoteSubscriptionRequest, tabId: string) => void;
  readonly onRemoteUnsubscribe: (request: RemoteSubscriptionRequest, tabId: string) => void;
  readonly onRemoteTabGone: (tabId: string) => void;
  readonly onRemoteData: (key: string, event: E) => void;
  readonly onLeaderState: (state: string) => void;
}

export interface TabCoordinator<E> {
  role(): TabRole;
  whenReady(): Promise<void>;
  postLeaderState(state: string): void;
  postData(key: string, event: E): void;
  postSubscribe(request: RemoteSubscriptionRequest): void;
  postUnsubscribe(request: RemoteSubscriptionRequest): void;
  dispose(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readRequest = (value: unknown): RemoteSubscriptionRequest | null => {
  if (!isRecord(value)) return null;
  const key = value.key;
  const user = value.user;
  const channel = value.channel;
  if (typeof key !== "string" || typeof user !== "string" || typeof channel !== "string") {
    return null;
  }
  return { key, user, channel };
};

const readTabId = (value: unknown): string | null =>
  isRecord(value) && typeof value.tabId === "string" ? value.tabId : null;

export function createTabCoordinator<E>(options: TabCoordinatorOptions<E>): TabCoordinator<E> {
  let role: TabRole = "undecided";
  let leaderId: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let resolveReady: (() => void) | null = null;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const channel = options.createChannel("0xsignal:user-stream:v1");
  const clearTimer = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const settle = (next: TabRole): void => {
    role = next;
    clearTimer();
    resolveReady?.();
  };

  const becomeLeader = (): void => {
    if (role === "leader") return;
    settle("leader");
    leaderId = options.tabId;
    channel.send({ kind: "leader", tabId: options.tabId });
    options.onPromote();
  };

  const becomeFollower = (id: string): void => {
    const wasLeader = role === "leader";
    leaderId = id;
    if (role !== "follower") settle("follower");
    if (wasLeader) options.onDemote();
  };

  const scheduleElection = (delay: number): void => {
    if (role === "leader") return;
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      if (role !== "leader") becomeLeader();
    }, delay);
  };

  const onMessage = (event: MessageEvent<unknown>): void => {
    const message = event.data;
    if (!isRecord(message) || typeof message.kind !== "string") return;

    if (message.kind === "probe") {
      if (role === "leader") channel.send({ kind: "leader", tabId: options.tabId });
      return;
    }

    if (message.kind === "leader") {
      const id = readTabId(message);
      if (id === null || id === options.tabId) return;
      if (role === "leader") {
        // Simultaneous claims: the lower id wins so the split never persists.
        if (id < options.tabId) becomeFollower(id);
        return;
      }
      becomeFollower(id);
      return;
    }

    if (message.kind === "bye") {
      const id = readTabId(message);
      if (id === null) return;
      options.onRemoteTabGone(id);
      if (role !== "leader" && (leaderId === null || leaderId === id)) {
        leaderId = null;
        scheduleElection(options.electionDelayMs);
      }
      return;
    }

    if (message.kind === "state") {
      if (role !== "leader" && typeof message.state === "string") {
        options.onLeaderState(message.state);
      }
      return;
    }

    if (message.kind === "data") {
      if (role === "leader") return;
      const key = message.key;
      if (typeof key !== "string" || !options.isEvent(message.event)) return;
      options.onRemoteData(key, message.event);
      return;
    }

    if (message.kind === "subscribe" || message.kind === "unsubscribe") {
      if (role !== "leader") return;
      const request = readRequest(message);
      const id = readTabId(message);
      if (request === null || id === null || id === options.tabId) return;
      if (message.kind === "subscribe") options.onRemoteSubscribe(request, id);
      else options.onRemoteUnsubscribe(request, id);
    }
  };

  channel.addEventListener("message", onMessage);
  channel.send({ kind: "probe", tabId: options.tabId });
  scheduleElection(options.electionDelayMs);

  return {
    role: () => role,
    whenReady: () => ready,
    postLeaderState: (state) => {
      channel.send({ kind: "state", state });
    },
    postData: (key, event) => {
      channel.send({ kind: "data", key, event });
    },
    postSubscribe: (request) => {
      channel.send({ kind: "subscribe", ...request, tabId: options.tabId });
    },
    postUnsubscribe: (request) => {
      channel.send({ kind: "unsubscribe", ...request, tabId: options.tabId });
    },
    dispose: () => {
      channel.send({ kind: "bye", tabId: options.tabId });
      channel.close();
      clearTimer();
    },
  };
}
