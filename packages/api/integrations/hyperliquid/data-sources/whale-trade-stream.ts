import { Context, Effect, Layer, Queue, Stream } from "effect";
import { SubscriptionClient, WebSocketTransport } from "@nktkas/hyperliquid";
import type { ISubscription } from "@nktkas/hyperliquid";
import type { TradesEvent } from "@nktkas/hyperliquid/api/subscription";
import type { WhaleSide, WhaleTrade } from "@0xsignal/shared";
import { WhaleConfig } from "../../../infrastructure/config/whale.config";
import { BoundedTidSet } from "./bounded-tid-set";
import { HyperliquidError, toHyperliquidError } from "./errors";

export interface WhaleTradeStreamProvider {
  readonly trades: () => Stream.Stream<WhaleTrade, HyperliquidError>;
}

export class WhaleTradeStream extends Context.Service<WhaleTradeStream, WhaleTradeStreamProvider>()(
  "WhaleTradeStream",
) {}

const toWhaleTrade = (trade: TradesEvent[number], minNotionalUsd: number): WhaleTrade | null => {
  const notionalUsd = Number(trade.px) * Number(trade.sz);
  // minNotionalUsd <= 0 means "no filter": every finite trade passes.
  if (!Number.isFinite(notionalUsd)) return null;
  if (minNotionalUsd > 0 && notionalUsd < minNotionalUsd) return null;

  const side: WhaleSide = trade.side === "B" ? "buy" : "sell";
  const [buyer, seller] = trade.users;

  return {
    tid: String(trade.tid),
    user: side === "buy" ? buyer : seller,
    coin: trade.coin,
    side,
    px: trade.px,
    sz: trade.sz,
    notionalUsd,
    time: new Date(trade.time).toISOString(),
  };
};

const MAX_SEEN_TIDS = 10_000;

// A discovery tick drains the queue for at most 5s, so the cap only has to
// absorb a burst, not a sustained consumer. Sliding keeps the newest trades:
// the aggregation only samples recent whale activity, and the oldest backlog
// could never be drained inside the window anyway.
const TRADE_QUEUE_CAPACITY = 4_096;

interface TradeCounters {
  seen: number;
  accepted: number;
  dropped: number;
}

const COUNTERS_LOG_INTERVAL = "10 seconds";

const subscribeCoin = (
  subscriptionClient: SubscriptionClient,
  coin: string,
  minNotionalUsd: number,
  seenTids: BoundedTidSet,
  counters: TradeCounters,
  queue: Queue.Queue<WhaleTrade, HyperliquidError>,
): Effect.Effect<ISubscription, HyperliquidError> =>
  Effect.tryPromise({
    try: () =>
      subscriptionClient.trades(
        { coin },
        (trades) => {
          // Listener is invoked on the sync transport callback (non-Effect),
          // so the queue is offered to unsafely and dedupe state is a plain
          // bounded set.
          for (const trade of trades) {
            if (seenTids.has(trade.tid)) continue;
            seenTids.add(trade.tid);
            counters.seen += 1;
            const whale = toWhaleTrade(trade, minNotionalUsd);
            if (whale === null) {
              counters.dropped += 1;
            } else {
              counters.accepted += 1;
              Queue.offerUnsafe(queue, whale);
            }
          }
        },
        {
          // A confirmed subscription failing fires at most once and detaches the
          // listener, so propagate it: fail the bridge queue and let the consumer
          // restart rather than stall on a dead connection.
          onError: (error) => {
            Effect.runSync(
              Queue.fail(
                queue,
                toHyperliquidError(`Failed to subscribe to trades for ${coin}`, error),
              ),
            );
          },
        },
      ),
    catch: (cause) => toHyperliquidError(`Failed to subscribe to trades for ${coin}`, cause),
  });

/**
 * Cold stream: each run opens one `trades` subscription per coin over the
 * shared transport and tears them down when the consuming scope closes.
 */
const openTradeStream = (
  subscriptionClient: SubscriptionClient,
  coinUniverse: ReadonlyArray<string>,
  minNotionalUsd: number,
): Stream.Stream<WhaleTrade, HyperliquidError> =>
  Stream.scoped(
    Stream.fromEffect(
      Effect.gen(function* () {
        const queue = yield* Queue.sliding<WhaleTrade, HyperliquidError>(TRADE_QUEUE_CAPACITY);
        const seenTids = new BoundedTidSet(MAX_SEEN_TIDS);
        const counters: TradeCounters = { seen: 0, accepted: 0, dropped: 0 };

        // Periodic heartbeat so a mis-set threshold (accepted=0) or a dead
        // stream (seen=0) is visible in logs rather than silently empty.
        yield* Effect.sleep(COUNTERS_LOG_INTERVAL).pipe(
          Effect.andThen(
            Effect.logInfo(
              `[whale] trades counters seen=${counters.seen} accepted=${counters.accepted} dropped=${counters.dropped} minNotionalUsd=${minNotionalUsd}`,
            ),
          ),
          Effect.forever,
          Effect.forkScoped,
        );

        const subscriptions = yield* Effect.forEach(coinUniverse, (coin) =>
          subscribeCoin(subscriptionClient, coin, minNotionalUsd, seenTids, counters, queue),
        );

        yield* Effect.addFinalizer(() =>
          Effect.forEach(
            subscriptions,
            (subscription) => Effect.promise(() => subscription.unsubscribe()),
            { discard: true },
          ),
        );

        return queue;
      }),
    ).pipe(Stream.flatMap((queue) => Stream.fromQueue(queue))),
  );

export const whaleTradeStreamLayer: Layer.Layer<WhaleTradeStream, never, WhaleConfig> =
  Layer.effect(
    WhaleTradeStream,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const { coinUniverse, whaleNotionalUsd } = yield* WhaleConfig;

        // One transport => one upstream WebSocket connection, shared by every
        // per-coin `trades` subscription (HL allows up to 10 connections).
        const transport = new WebSocketTransport({ resubscribe: true });
        const subscriptionClient = new SubscriptionClient({ transport });

        const service = WhaleTradeStream.of({
          trades: () => openTradeStream(subscriptionClient, coinUniverse, whaleNotionalUsd),
        });

        return { transport, service } as const;
      }),
      ({ transport }) =>
        Effect.sync(() => {
          transport.close();
        }),
    ).pipe(Effect.map(({ service }) => service)),
  );
