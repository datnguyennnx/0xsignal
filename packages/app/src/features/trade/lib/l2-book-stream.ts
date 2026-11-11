import {
  WsClient,
  mergeL2Book,
  type BookFrame,
  type BookLevel,
  type MergedBook,
} from "@0xsignal/sdk-hyperliquid/subscription";
import { MAX_BOOK_DEPTH } from "@/core/utils/hyperliquid";
import { readBookLeg, type BookLegFrame } from "./l2-book-merge";

const HL_BOOK_WS_URL = "wss://api.hyperliquid.xyz/ws";
const DEFAULT_SETTLE_MS = 120;

interface BookParams {
  readonly coin: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
}

type BookLeg = "fast" | "slow";

interface L2BookSubscription {
  readonly type: "l2Book";
  readonly coin: string;
  readonly nSigFigs?: 2 | 3 | 4 | 5;
  readonly fast: boolean;
}

interface BookLegHandle {
  unsubscribe(): void;
}

interface BookClient {
  subscribe(
    subscription: L2BookSubscription,
    onData: (data: unknown) => void,
    options?: { onError?: (error: unknown) => void },
  ): BookLegHandle;
  close(): void;
}

export interface BookStreamOptions {
  readonly url?: string;
  readonly depth?: number;
  readonly now?: () => number;
  readonly settleMs?: number;
  readonly createClient?: (url: string) => BookClient;
}

interface BookStreamHandle {
  unsubscribe(): void;
}

interface BookListener {
  readonly onData: (snapshot: MergedBook) => void;
  readonly onError: (error: Error) => void;
}

interface BookEntry {
  readonly fast: BookClient;
  readonly slow: BookClient;
  readonly createdAt: number;
  fastHandle: BookLegHandle | null;
  slowHandle: BookLegHandle | null;
  fastFrame: BookFrame | null;
  slowFrame: BookFrame | null;
  fastTime: number;
  slowTime: number;
  fastContradicted: boolean;
  slowContradicted: boolean;
  lastEmitted: MergedBook | null;
  pending: MergedBook | null;
  pendingTimer: ReturnType<typeof setTimeout> | null;
  emitScheduled: boolean;
  readonly listeners: Set<BookListener>;
}

export interface BookStream {
  subscribe(
    params: BookParams,
    onData: (snapshot: MergedBook) => void,
    onError?: (error: Error) => void,
  ): BookStreamHandle;
  close(): void;
}

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const bookKey = (params: BookParams): string => `${params.coin}:${params.nSigFigs ?? "raw"}`;

const legTime = (entry: BookEntry, leg: BookLeg): number =>
  leg === "fast" ? entry.fastTime : entry.slowTime;

const recordLeg = (entry: BookEntry, leg: BookLeg, frame: BookFrame): void => {
  if (leg === "fast") {
    entry.fastFrame = frame;
    entry.fastTime = frame.time;
    return;
  }
  entry.slowFrame = frame;
  entry.slowTime = frame.time;
};

const contradictsLeg = (leg: BookLeg, frame: BookLegFrame): boolean =>
  leg === "fast" ? frame.fast === false : frame.fast === true;

const defaultCreateClient = (url: string): BookClient =>
  new WsClient({ url, shouldReconnect: true });

const failAll = (entry: BookEntry, error: Error): void => {
  for (const listener of entry.listeners) listener.onError(error);
};

const reportContradiction = (entry: BookEntry, leg: BookLeg): void => {
  if (leg === "fast") {
    if (entry.fastContradicted) return;
    entry.fastContradicted = true;
  } else {
    if (entry.slowContradicted) return;
    entry.slowContradicted = true;
  }
  failAll(entry, new Error(`l2Book ${leg} socket received a frame flagged for the other leg`));
};

const clearPending = (entry: BookEntry): void => {
  if (entry.pendingTimer !== null) clearTimeout(entry.pendingTimer);
  entry.pendingTimer = null;
  entry.pending = null;
};

const teardown = (entry: BookEntry): void => {
  clearPending(entry);
  entry.fastHandle?.unsubscribe();
  entry.slowHandle?.unsubscribe();
  entry.fast.close();
  entry.slow.close();
};

const sideUnchanged = (
  next: readonly BookLevel[],
  previous: readonly BookLevel[],
  depth: number,
): boolean => {
  if (next.length !== previous.length) return false;
  const limit = Math.min(next.length, previous.length, depth);
  for (let i = 0; i < limit; i += 1) {
    const current = next[i];
    const prior = previous[i];
    if (current === undefined || prior === undefined) return false;
    if (current.px !== prior.px || current.sz !== prior.sz) return false;
  }
  return true;
};

const sameBook = (next: MergedBook, previous: MergedBook, depth: number): boolean => {
  if (next.degraded.length !== previous.degraded.length) return false;
  for (let i = 0; i < next.degraded.length; i += 1) {
    if (next.degraded[i] !== previous.degraded[i]) return false;
  }
  return (
    sideUnchanged(next.levels[0], previous.levels[0], depth) &&
    sideUnchanged(next.levels[1], previous.levels[1], depth)
  );
};

export function createBookStream(options: BookStreamOptions = {}): BookStream {
  const url = options.url ?? HL_BOOK_WS_URL;
  const depth = options.depth ?? MAX_BOOK_DEPTH;
  const now = options.now ?? Date.now;
  const settleMs = options.settleMs ?? DEFAULT_SETTLE_MS;
  const createClient = options.createClient ?? defaultCreateClient;
  const books = new Map<string, BookEntry>();
  let closed = false;

  const deliver = (entry: BookEntry, merged: MergedBook): void => {
    if (entry.lastEmitted !== null && sameBook(merged, entry.lastEmitted, depth)) return;
    const time = Math.max(merged.time, entry.lastEmitted?.time ?? 0);
    const snapshot = time === merged.time ? merged : { ...merged, time };
    entry.lastEmitted = snapshot;
    for (const listener of entry.listeners) listener.onData(snapshot);
  };

  const flushPending = (entry: BookEntry): void => {
    entry.pendingTimer = null;
    const snapshot = entry.pending;
    entry.pending = null;
    if (snapshot === null) return;
    if (entry.listeners.size === 0) return;
    deliver(entry, snapshot);
  };

  const hold = (entry: BookEntry, merged: MergedBook, at: number): void => {
    entry.pending = merged;
    if (entry.pendingTimer !== null) return;
    entry.pendingTimer = setTimeout(
      () => {
        flushPending(entry);
      },
      Math.max(0, settleMs - (at - entry.createdAt)),
    );
  };

  const emit = (entry: BookEntry): void => {
    if (entry.listeners.size === 0) return;
    const at = now();
    const merged = mergeL2Book(entry.fastFrame, entry.slowFrame, depth, at);
    if (merged === null) return;
    if (merged.degraded.length > 0 && at - entry.createdAt < settleMs) {
      hold(entry, merged, at);
      return;
    }
    clearPending(entry);
    deliver(entry, merged);
  };

  const scheduleEmit = (entry: BookEntry): void => {
    if (entry.emitScheduled) return;
    entry.emitScheduled = true;
    queueMicrotask(() => {
      entry.emitScheduled = false;
      emit(entry);
    });
  };

  const acceptLeg = (entry: BookEntry, leg: BookLeg, event: unknown): void => {
    const frame = readBookLeg(event);
    if (frame === null) return;
    if (contradictsLeg(leg, frame)) {
      reportContradiction(entry, leg);
      return;
    }
    if (frame.time < legTime(entry, leg)) return;
    recordLeg(entry, leg, frame);
    scheduleEmit(entry);
  };

  const release = (key: string, entry: BookEntry, listener: BookListener): void => {
    if (!entry.listeners.delete(listener)) return;
    if (entry.listeners.size > 0) return;
    if (books.get(key) === entry) books.delete(key);
    teardown(entry);
  };

  const open = (params: BookParams, listener: BookListener): BookEntry => {
    const subscription = (fast: boolean): L2BookSubscription => ({
      type: "l2Book",
      coin: params.coin,
      ...(params.nSigFigs !== undefined && { nSigFigs: params.nSigFigs }),
      fast,
    });
    const fast = createClient(url);
    const slow = createClient(url);
    const entry: BookEntry = {
      fast,
      slow,
      createdAt: now(),
      fastHandle: null,
      slowHandle: null,
      fastFrame: null,
      slowFrame: null,
      fastTime: Number.NEGATIVE_INFINITY,
      slowTime: Number.NEGATIVE_INFINITY,
      fastContradicted: false,
      slowContradicted: false,
      lastEmitted: null,
      pending: null,
      pendingTimer: null,
      emitScheduled: false,
      listeners: new Set([listener]),
    };
    entry.fastHandle = fast.subscribe(
      subscription(true),
      (event) => {
        acceptLeg(entry, "fast", event);
      },
      {
        onError: (error) => {
          failAll(entry, toError(error));
        },
      },
    );
    entry.slowHandle = slow.subscribe(
      subscription(false),
      (event) => {
        acceptLeg(entry, "slow", event);
      },
      {
        onError: (error) => {
          failAll(entry, toError(error));
        },
      },
    );
    return entry;
  };

  return {
    subscribe: (params, onData, onError = () => {}) => {
      if (closed) return { unsubscribe: () => {} };
      const key = bookKey(params);
      const listener: BookListener = { onData, onError };
      const existing = books.get(key);
      if (existing !== undefined) {
        existing.listeners.add(listener);
        return {
          unsubscribe: () => {
            release(key, existing, listener);
          },
        };
      }
      const entry = open(params, listener);
      books.set(key, entry);
      return {
        unsubscribe: () => {
          release(key, entry, listener);
        },
      };
    },
    close: () => {
      if (closed) return;
      closed = true;
      for (const entry of books.values()) {
        entry.listeners.clear();
        teardown(entry);
      }
      books.clear();
    },
  };
}
