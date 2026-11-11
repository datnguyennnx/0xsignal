/**
 * @hyperliquid-api wss://api.hyperliquid.xyz/ws
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/websocket.md
 */

import { TransportError, ValidationError, WeightError } from "../core/errors";
import { cast } from "../core/parse";
import {
  CHANNEL_OF,
  HEARTBEAT_IDLE_MS,
  MAX_CONNECTIONS,
  MAX_INFLIGHT_POSTS,
  MAX_MESSAGES_PER_MIN,
  MAX_NEW_CONNECTIONS_PER_MIN,
  MAX_SUBSCRIPTIONS,
  MAX_UNIQUE_USERS,
  PING_FRAME,
  decodeData,
  subscribeFrame,
  unsubscribeFrame,
} from "./channels";
import type { PayloadOf, Subscription, SubscriptionPayload } from "./types";
import {
  bookRouteDiscriminator,
  coreDiscriminatorOf,
  frameDiscriminatorOf,
  frameText,
  hasSnapshotFlag,
  subscriptionDiscriminatorOf,
} from "./frame";

const MAINNET_URL = "wss://api.hyperliquid.xyz/ws";
const TESTNET_URL = "wss://api.hyperliquid-testnet.xyz/ws";
const DEFAULT_PING_MS = 30_000;
const DEFAULT_MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 500;
const ACK_TIMEOUT_MS = 10_000;
const MAX_ACK_RETRIES = 2;
const RATE_WINDOW_MS = 60_000;

export type WsStatus = "connecting" | "open" | "closed" | "reconnecting";

export type WsClientOptions = {
  url?: string;
  isTestnet?: boolean;
  pingIntervalMs?: number;
  shouldReconnect?: boolean;
  maxReconnectDelayMs?: number;
  webSocketImpl?: typeof WebSocket;
};

export type SubscribeOptions = {
  onError?: (error: unknown) => void;
};

export type SubscriptionHandle = {
  readonly subscription: Subscription;
  unsubscribe(): void;
  unsubscribeAsync(): Promise<void>;
};

type Handler = (data: unknown) => void;

type DispatchPayload = SubscriptionPayload[Subscription["type"]];

type SubscriptionHandler = { dispatch(data: DispatchPayload): void }["dispatch"];

function deliverSubscription(handler: SubscriptionHandler, data: DispatchPayload): void {
  handler(data);
}

type PendingPost = { handler: Handler; timer: ReturnType<typeof setTimeout> };

type PostRequest = { type: "info" | "action"; payload: unknown };

type SubscriptionEntry = {
  subscription: Subscription;
  handler: SubscriptionHandler;
  onError: ((error: unknown) => void) | undefined;
  channel: string;
  key: string;
  sendKey: string;
  routeKey: string;
  wildcard: boolean;
};

function pruneConnections(timestamps: number[], now: number): void {
  while (timestamps.length > 0) {
    const oldest = timestamps[0];
    if (oldest === undefined || now - oldest < RATE_WINDOW_MS) return;
    timestamps.shift();
  }
}

function subscriptionKey(subscription: Subscription): string {
  return JSON.stringify(subscription);
}

function canonicalKeyOf(subscription: Subscription): string {
  if (subscription.type === "l2Book") {
    return `${CHANNEL_OF[subscription.type]}|${bookRouteDiscriminator(subscription)}`;
  }
  return `${CHANNEL_OF[subscription.type]}|${subscriptionDiscriminatorOf(subscription)}`;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  if (typeof value !== "object" || value === null) return value;
  const record = cast<Record<string, unknown>>(value, "subscription");
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(record);
  keys.sort();
  for (const key of keys) sorted[key] = canonicalize(record[key]);
  return sorted;
}

function sendKeyOf(subscription: Subscription): string {
  return JSON.stringify(canonicalize(subscription));
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function matchesEcho(subscription: Subscription, echoed: Record<string, unknown>): boolean {
  const record = cast<Record<string, unknown>>(subscription, "subscription");
  return Object.keys(record).every((key) => {
    const sent = record[key];
    if (sent === undefined) return true;
    return sameValue(sent ?? null, echoed[key] ?? null);
  });
}

const WILDCARD_TYPES: ReadonlySet<Subscription["type"]> = new Set(["allDexsClearinghouseState"]);

function isWildcardSubscription(subscription: Subscription): boolean {
  return WILDCARD_TYPES.has(subscription.type) || subscriptionDiscriminatorOf(subscription) === "";
}

function userOf(subscription: Subscription): string | undefined {
  return "user" in subscription && typeof subscription.user === "string"
    ? subscription.user
    : undefined;
}

export class WsClient {
  readonly #url: string;
  readonly #pingIntervalMs: number;
  readonly #shouldReconnect: boolean;
  readonly #maxReconnectDelayMs: number;
  readonly #Impl: typeof WebSocket;
  readonly #entries: SubscriptionEntry[] = [];
  readonly #handlers = new Map<string, Set<SubscriptionEntry>>();
  readonly #wildcards = new Map<string, Set<SubscriptionEntry>>();
  readonly #errorListeners = new Set<(error: unknown) => void>();
  readonly #statusListeners = new Set<(status: WsStatus) => void>();
  readonly #pending = new Map<string, ReturnType<typeof setTimeout>>();
  readonly #ackRetries = new Map<string, number>();
  readonly #posts = new Map<number, PendingPost>();
  readonly #messageTimestamps: number[] = [];
  readonly #connectionTimestamps: number[] = [];
  readonly #snapshotsSeen = new Set<string>();
  readonly #termination = new AbortController();
  #status: WsStatus = "connecting";
  #socket: WebSocket | null = null;
  #heartbeat: ReturnType<typeof setInterval> | null = null;
  #reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  #lastMessageAt = 0;
  #lastPingAt = 0;
  #postId = 0;
  #openConnections = 0;
  #attempt = 0;
  #closed = false;

  constructor(o: WsClientOptions = {}) {
    const Impl =
      o.webSocketImpl ?? cast<{ WebSocket?: typeof WebSocket }>(globalThis, "WebSocket").WebSocket;
    if (Impl === undefined) throw new TransportError("WebSocket is not available");
    this.#Impl = Impl;
    this.#url = o.url ?? (o.isTestnet === true ? TESTNET_URL : MAINNET_URL);
    this.#pingIntervalMs = Math.min(o.pingIntervalMs ?? DEFAULT_PING_MS, HEARTBEAT_IDLE_MS);
    this.#shouldReconnect = o.shouldReconnect ?? true;
    this.#maxReconnectDelayMs = o.maxReconnectDelayMs ?? DEFAULT_MAX_RECONNECT_DELAY_MS;
    this.#connect();
  }

  subscribe<S extends Subscription>(
    subscription: S,
    onData: (data: PayloadOf<S>) => void,
    options: SubscribeOptions = {},
  ): SubscriptionHandle {
    const key = subscriptionKey(subscription);
    this.#assertSubscriptionLimits(subscription, key);
    const channel = CHANNEL_OF[subscription.type];
    const sendKey = sendKeyOf(subscription);
    const entry: SubscriptionEntry = {
      subscription,
      handler: onData,
      onError: options.onError,
      channel,
      key,
      sendKey,
      routeKey: canonicalKeyOf(subscription),
      wildcard: isWildcardSubscription(subscription),
    };
    this.#entries.push(entry);
    this.#registerHandler(entry);
    try {
      this.#sendSubscribe(subscription, sendKey);
    } catch (error) {
      this.#dropEntry(entry);
      this.#clearPending(sendKey);
      throw error;
    }
    let live = true;
    return {
      subscription,
      unsubscribe: () => {
        if (!live) return;
        live = false;
        this.#removeEntry(entry);
      },
      unsubscribeAsync: () => {
        if (live) {
          live = false;
          this.#removeEntry(entry);
        }
        return Promise.resolve();
      },
    };
  }

  post(request: PostRequest, onData: Handler): void {
    const socket = this.#socket;
    if (socket === null || socket.readyState !== this.#Impl.OPEN) {
      throw new TransportError(new Error("websocket is not open"));
    }
    if (this.#posts.size >= MAX_INFLIGHT_POSTS) {
      throw new WeightError(`inflight post limit ${MAX_INFLIGHT_POSTS} reached`);
    }
    this.#postId += 1;
    const id = this.#postId;
    this.#sendFrame({ method: "post", id, request });
    const timer = setTimeout(() => {
      this.#posts.delete(id);
      this.#emitError(new Error(`post response timeout after ${ACK_TIMEOUT_MS}ms: ${id}`));
    }, ACK_TIMEOUT_MS);
    this.#posts.set(id, { handler: onData, timer });
  }

  hasSnapshot(key: string): boolean {
    return this.#snapshotsSeen.has(key);
  }

  onError(cb: (error: unknown) => void): () => void {
    this.#errorListeners.add(cb);
    return () => {
      this.#errorListeners.delete(cb);
    };
  }

  onStatus(cb: (status: WsStatus) => void): () => void {
    this.#statusListeners.add(cb);
    return () => {
      this.#statusListeners.delete(cb);
    };
  }

  get status(): WsStatus {
    return this.#status;
  }

  get terminationSignal(): AbortSignal {
    return this.#termination.signal;
  }

  reconnect(): void {
    if (this.#closed) return;
    this.#clearReconnect();
    const socket = this.#socket;
    this.#socket = null;
    if (socket !== null) {
      this.#stopHeartbeat();
      this.#clearAllPending();
      this.#clearAllPosts();
      socket.close();
    }
    try {
      this.#connect();
    } catch (error) {
      this.#emitError(error);
      this.#scheduleReconnect();
    }
  }

  close(): void {
    this.#closed = true;
    this.#snapshotsSeen.clear();
    this.#stopHeartbeat();
    this.#clearReconnect();
    this.#clearAllPending();
    this.#clearAllPosts();
    const socket = this.#socket;
    this.#socket = null;
    if (socket !== null) socket.close();
    this.#setStatus("closed");
    this.#terminate();
  }

  #connect(): void {
    this.#snapshotsSeen.clear();
    const now = Date.now();
    pruneConnections(this.#connectionTimestamps, now);
    if (this.#openConnections >= MAX_CONNECTIONS) {
      throw new WeightError(`connection limit ${MAX_CONNECTIONS} reached`);
    }
    if (this.#connectionTimestamps.length >= MAX_NEW_CONNECTIONS_PER_MIN) {
      throw new WeightError(`new connection limit ${MAX_NEW_CONNECTIONS_PER_MIN}/min reached`);
    }
    const socket = new this.#Impl(this.#url);
    this.#connectionTimestamps.push(now);
    this.#openConnections += 1;
    this.#socket = socket;
    this.#setStatus("connecting");
    let counted = true;

    socket.addEventListener("open", () => {
      if (this.#socket !== socket) return;
      this.#attempt = 0;
      this.#setStatus("open");
      this.#startHeartbeat();
      this.#resubscribe();
    });
    socket.addEventListener("message", (event) => {
      if (this.#socket !== socket) return;
      void this.#handleMessage(event.data);
    });
    socket.addEventListener("error", (event) => {
      if (this.#socket !== socket) return;
      this.#emitError(event);
    });
    socket.addEventListener("close", () => {
      if (counted) {
        counted = false;
        this.#openConnections -= 1;
      }
      if (this.#socket !== socket) return;
      this.#socket = null;
      this.#stopHeartbeat();
      this.#clearAllPending();
      this.#clearAllPosts();
      this.#setStatus("closed");
      if (!this.#closed) this.#scheduleReconnect();
    });
  }

  #scheduleReconnect(): void {
    if (!this.#shouldReconnect || this.#closed) return;
    const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** this.#attempt, this.#maxReconnectDelayMs);
    this.#attempt += 1;
    this.#setStatus("reconnecting");
    this.#reconnectTimer = setTimeout(
      () => {
        this.#reconnectTimer = null;
        if (this.#closed) return;
        try {
          this.#connect();
        } catch (error) {
          this.#emitError(error);
          this.#scheduleReconnect();
        }
      },
      delay * (0.5 + Math.random() * 0.5),
    );
  }

  #resubscribe(): void {
    const seen = new Set<string>();
    for (const entry of this.#entries) {
      if (seen.has(entry.sendKey)) continue;
      seen.add(entry.sendKey);
      try {
        this.#sendSubscribe(entry.subscription, entry.sendKey);
      } catch (error) {
        this.#emitError(error);
      }
    }
  }

  #sendSubscribe(subscription: Subscription, sendKey: string): void {
    const socket = this.#socket;
    if (socket === null || socket.readyState !== this.#Impl.OPEN) return;
    if (this.#pending.has(sendKey)) return;
    this.#sendFrame(subscribeFrame(subscription));
    this.#armAckTimer(subscription, sendKey);
  }

  #armAckTimer(subscription: Subscription, sendKey: string): void {
    const timer = setTimeout(() => {
      this.#pending.delete(sendKey);
      this.#handleAckTimeout(subscription, sendKey);
    }, ACK_TIMEOUT_MS);
    this.#pending.set(sendKey, timer);
  }

  #handleAckTimeout(subscription: Subscription, sendKey: string): void {
    const socket = this.#socket;
    if (socket === null || socket.readyState !== this.#Impl.OPEN) return;
    const attempts = this.#ackRetries.get(sendKey) ?? 0;
    if (attempts < MAX_ACK_RETRIES) {
      this.#ackRetries.set(sendKey, attempts + 1);
      try {
        this.#sendFrame(subscribeFrame(subscription));
        this.#armAckTimer(subscription, sendKey);
        return;
      } catch (error) {
        this.#ackRetries.delete(sendKey);
        this.#emitSubscriptionError(sendKey, error);
        this.#emitError(error);
        this.#dropEntriesByKey(sendKey);
        return;
      }
    }
    this.#ackRetries.delete(sendKey);
    const error = new Error(`subscription ack timeout after ${ACK_TIMEOUT_MS}ms: ${sendKey}`);
    this.#emitSubscriptionError(sendKey, error);
    this.#emitError(error);
    this.#dropEntriesByKey(sendKey);
  }

  async #handleMessage(payload: unknown): Promise<void> {
    this.#lastMessageAt = Date.now();
    let text: string;
    try {
      text = await frameText(payload);
    } catch (error) {
      this.#emitError(error);
      return;
    }
    let frame: unknown;
    try {
      frame = JSON.parse(text);
    } catch (error) {
      this.#emitError(error);
      return;
    }
    if (typeof frame !== "object" || frame === null) {
      this.#emitError(new ValidationError("frame.channel", "string"));
      return;
    }
    const channel = "channel" in frame ? frame.channel : undefined;
    if (typeof channel !== "string") {
      this.#emitError(new ValidationError("frame.channel", "string"));
      return;
    }
    const data = "data" in frame ? frame.data : undefined;
    if (channel === "subscriptionResponse") {
      this.#handleAck(data);
      return;
    }
    if (channel === "post") {
      this.#handlePost(data);
      return;
    }
    if (channel === "pong") {
      this.#lastPingAt = 0;
      return;
    }
    if (channel === "error") {
      const error = new Error(typeof data === "string" ? data : "websocket error frame");
      this.#emitFrameError(data, error);
      this.#emitError(error);
      return;
    }
    const entries = this.#handlersFor(channel, data);
    if (entries === undefined || entries.size === 0) {
      const discriminator = frameDiscriminatorOf(channel, data);
      this.#emitError(
        new ValidationError(`frame.channel:${channel}|${discriminator}`, "a matching subscription"),
      );
      return;
    }
    void this.#dispatch(channel, data, entries);
  }

  #handlersFor(channel: string, payload: unknown): Set<SubscriptionEntry> | undefined {
    const discriminator = frameDiscriminatorOf(channel, payload);
    if (channel === CHANNEL_OF.l2Book) {
      if (discriminator !== "") {
        const exact = this.#handlers.get(`${channel}|${discriminator}`);
        if (exact !== undefined) return exact;
        const leg = this.#bookHandlersFor(discriminator);
        if (leg !== undefined) return leg;
      }
      return this.#wildcards.get(channel);
    }
    const core = coreDiscriminatorOf(payload);
    if (discriminator !== "") {
      const exact = this.#handlers.get(`${channel}|${discriminator}`);
      if (exact !== undefined) return exact;
      if (discriminator !== core) return undefined;
    }
    if (core !== "") {
      const fallback = this.#coreHandlersFor(channel, core);
      if (fallback !== undefined) return fallback;
    }
    return this.#wildcards.get(channel);
  }

  #bookHandlersFor(discriminator: string): Set<SubscriptionEntry> | undefined {
    const split = discriminator.lastIndexOf("|");
    if (split <= 0) return undefined;
    const prefix = `${CHANNEL_OF.l2Book}|${discriminator.slice(0, split)}|`;
    const suffix = `|${discriminator.slice(split + 1)}`;
    const merged = new Set<SubscriptionEntry>();
    for (const [key, entries] of this.#handlers) {
      if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
      for (const entry of entries) merged.add(entry);
    }
    return merged.size === 0 ? undefined : merged;
  }

  #coreHandlersFor(channel: string, core: string): Set<SubscriptionEntry> | undefined {
    const coreKey = `${channel}|${core}`;
    const nested = `${coreKey}|`;
    const merged = new Set<SubscriptionEntry>();
    for (const [key, entries] of this.#handlers) {
      if (key !== coreKey && !key.startsWith(nested)) continue;
      for (const entry of entries) merged.add(entry);
    }
    return merged.size === 0 ? undefined : merged;
  }

  #handlePost(data: unknown): void {
    if (typeof data !== "object" || data === null) return;
    const record = cast<Record<string, unknown>>(data, "post.data");
    const id = record["id"];
    if (typeof id !== "number") return;
    const pending = this.#posts.get(id);
    if (pending === undefined) return;
    clearTimeout(pending.timer);
    this.#posts.delete(id);
    try {
      pending.handler(record["response"]);
    } catch (error) {
      this.#emitError(error);
    }
  }

  #handleAck(data: unknown): void {
    if (typeof data !== "object" || data === null) return;
    const subscription = "subscription" in data ? data.subscription : undefined;
    if (typeof subscription !== "object" || subscription === null) return;
    const echoed = cast<Subscription>(subscription, "subscription");
    for (const entry of this.#matchingEntriesOf(echoed)) this.#clearPending(entry.sendKey);
  }

  #matchingEntriesOf(echoed: Subscription): SubscriptionEntry[] {
    const exact = sendKeyOf(echoed);
    const routeKey = canonicalKeyOf(echoed);
    const echoedRecord = cast<Record<string, unknown>>(echoed, "subscription");
    const matches: SubscriptionEntry[] = [];
    for (const entry of this.#entries) {
      const exactMatch = entry.sendKey === exact;
      if (!exactMatch && entry.routeKey !== routeKey) continue;
      if (!exactMatch && !matchesEcho(entry.subscription, echoedRecord)) continue;
      matches.push(entry);
    }
    return matches;
  }

  async #dispatch(
    channel: string,
    payload: unknown,
    entries: Set<SubscriptionEntry>,
  ): Promise<void> {
    let data: unknown;
    try {
      const decoded = decodeData(channel, payload);
      data = decoded instanceof Promise ? await decoded : decoded;
    } catch (error) {
      this.#emitEntriesError(entries, error);
      this.#emitError(error);
      return;
    }
    for (const entry of entries) {
      if (hasSnapshotFlag(data)) this.#snapshotsSeen.add(entry.key);
      try {
        deliverSubscription(entry.handler, data);
      } catch (error) {
        this.#emitError(error);
      }
    }
  }

  #sendFrame(frame: unknown): void {
    const socket = this.#socket;
    if (socket === null || socket.readyState !== this.#Impl.OPEN) return;
    this.#takeMessageBudget();
    socket.send(JSON.stringify(frame));
  }

  #takeMessageBudget(): void {
    const now = Date.now();
    while (this.#messageTimestamps.length > 0) {
      const oldest = this.#messageTimestamps[0];
      if (oldest === undefined || now - oldest < RATE_WINDOW_MS) break;
      this.#messageTimestamps.shift();
    }
    if (this.#messageTimestamps.length >= MAX_MESSAGES_PER_MIN) {
      throw new WeightError(`outgoing message limit ${MAX_MESSAGES_PER_MIN}/min reached`);
    }
    this.#messageTimestamps.push(now);
  }

  #startHeartbeat(): void {
    this.#stopHeartbeat();
    this.#lastMessageAt = Date.now();
    this.#lastPingAt = 0;
    this.#heartbeat = setInterval(() => {
      try {
        const socket = this.#socket;
        if (socket === null || socket.readyState !== this.#Impl.OPEN) return;
        const now = Date.now();
        if (now - this.#lastMessageAt > HEARTBEAT_IDLE_MS) {
          this.#stopHeartbeat();
          socket.close();
          return;
        }
        if (this.#lastPingAt !== 0 && now - this.#lastPingAt < this.#pingIntervalMs) return;
        this.#sendFrame(PING_FRAME);
        this.#lastPingAt = now;
      } catch (error) {
        this.#emitError(error);
      }
    }, this.#pingIntervalMs);
  }

  #stopHeartbeat(): void {
    if (this.#heartbeat === null) return;
    clearInterval(this.#heartbeat);
    this.#heartbeat = null;
  }

  #clearReconnect(): void {
    if (this.#reconnectTimer === null) return;
    clearTimeout(this.#reconnectTimer);
    this.#reconnectTimer = null;
  }

  #clearPending(key: string): boolean {
    this.#ackRetries.delete(key);
    const timer = this.#pending.get(key);
    if (timer === undefined) return false;
    clearTimeout(timer);
    this.#pending.delete(key);
    return true;
  }

  #clearAllPending(): void {
    for (const timer of this.#pending.values()) clearTimeout(timer);
    this.#pending.clear();
    this.#ackRetries.clear();
  }

  #clearAllPosts(): void {
    for (const pending of this.#posts.values()) clearTimeout(pending.timer);
    this.#posts.clear();
  }

  #assertSubscriptionLimits(subscription: Subscription, key: string): void {
    const keys = new Set<string>();
    const users = new Set<string>();
    for (const entry of this.#entries) {
      keys.add(entry.key);
      const user = userOf(entry.subscription);
      if (user !== undefined) users.add(user);
    }
    if (
      this.#entries.length >= MAX_SUBSCRIPTIONS ||
      (!keys.has(key) && keys.size >= MAX_SUBSCRIPTIONS)
    ) {
      throw new ValidationError("subscription", `at most ${MAX_SUBSCRIPTIONS} subscriptions`);
    }
    const user = userOf(subscription);
    if (user !== undefined && !users.has(user) && users.size >= MAX_UNIQUE_USERS) {
      throw new ValidationError("subscription.user", `at most ${MAX_UNIQUE_USERS} unique users`);
    }
  }

  #registerHandler(entry: SubscriptionEntry): void {
    if (entry.wildcard) {
      const bucket = this.#wildcards.get(entry.channel);
      if (bucket === undefined) {
        this.#wildcards.set(entry.channel, new Set([entry]));
        return;
      }
      bucket.add(entry);
      return;
    }
    const handlers = this.#handlers.get(entry.routeKey);
    if (handlers === undefined) {
      this.#handlers.set(entry.routeKey, new Set([entry]));
      return;
    }
    handlers.add(entry);
  }

  #dropEntry(entry: SubscriptionEntry): void {
    const index = this.#entries.indexOf(entry);
    if (index >= 0) this.#entries.splice(index, 1);
    if (entry.wildcard) {
      const bucket = this.#wildcards.get(entry.channel);
      if (bucket === undefined) return;
      bucket.delete(entry);
      if (bucket.size === 0) this.#wildcards.delete(entry.channel);
      return;
    }
    const handlers = this.#handlers.get(entry.routeKey);
    if (handlers === undefined) return;
    handlers.delete(entry);
    if (handlers.size === 0) this.#handlers.delete(entry.routeKey);
  }

  #removeEntry(entry: SubscriptionEntry): void {
    this.#dropEntry(entry);
    if (this.#entries.some((other) => other.sendKey === entry.sendKey)) return;
    this.#snapshotsSeen.delete(entry.key);
    this.#clearPending(entry.sendKey);
    this.#sendFrame(unsubscribeFrame(entry.subscription));
  }

  #setStatus(status: WsStatus): void {
    this.#status = status;
    for (const listener of this.#statusListeners) {
      try {
        listener(status);
      } catch (error) {
        this.#emitError(error);
      }
    }
  }

  #emitError(error: unknown): void {
    for (const listener of this.#errorListeners) {
      try {
        listener(error);
      } catch {
        continue;
      }
    }
  }

  #emitSubscriptionError(sendKey: string, error: unknown): void {
    for (const entry of this.#entries) {
      if (entry.sendKey !== sendKey) continue;
      this.#callEntryError(entry, error);
    }
  }

  #emitEntriesError(entries: Iterable<SubscriptionEntry>, error: unknown): void {
    for (const entry of entries) this.#callEntryError(entry, error);
  }

  #emitFrameError(data: unknown, error: unknown): void {
    if (typeof data !== "object" || data === null) return;
    const subscription = "subscription" in data ? data.subscription : undefined;
    if (typeof subscription !== "object" || subscription === null) return;
    const echoed = cast<Subscription>(subscription, "subscription");
    for (const entry of this.#matchingEntriesOf(echoed)) this.#callEntryError(entry, error);
  }

  #callEntryError(entry: SubscriptionEntry, error: unknown): boolean {
    const onError = entry.onError;
    if (onError === undefined) return false;
    try {
      onError(error);
      return true;
    } catch {
      return false;
    }
  }

  #dropEntriesByKey(sendKey: string): void {
    for (const entry of this.#entries.slice()) {
      if (entry.sendKey !== sendKey) continue;
      this.#snapshotsSeen.delete(entry.key);
      this.#dropEntry(entry);
    }
  }

  #terminate(): void {
    if (this.#termination.signal.aborted) return;
    const error = new Error("ws client closed");
    error.name = "WsClosed";
    this.#termination.abort(error);
  }
}
