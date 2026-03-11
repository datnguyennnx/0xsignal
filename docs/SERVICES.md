# 0xSignal Services

Service definition and implementation patterns using Effect-TS.

## Service Pattern Overview

Every service follows a three-step pattern:

1. **Interface** - Define capabilities
2. **Tag** - Create Context.Tag for dependency injection
3. **Implementation** - Create Layer with Effect.gen

## Defining a Service

### Step 1: Interface

```typescript
// services/hyperliquid.ts
import { Effect, Context, Stream } from "effect";

export interface HyperliquidService {
  // Read operations
  readonly getPortfolio: (address: string) => Effect.Effect<Portfolio, HyperliquidError, never>;

  readonly getMarketData: (symbol: string) => Effect.Effect<MarketData, HyperliquidError, never>;

  // Real-time streams
  readonly subscribePrices: (
    symbols: string[]
  ) => Effect.Effect<Stream<PriceUpdate>, HyperliquidError, Scope>;
}
```

### Step 2: Tag

```typescript
// services/hyperliquid.ts
export class HyperliquidServiceTag extends Context.Tag("HyperliquidService")<
  HyperliquidServiceTag,
  HyperliquidService
>() {}
```

### Step 3: Implementation

```typescript
// services/hyperliquid-live.ts
import { Layer, Effect } from "effect";

export const HyperliquidServiceLive = Layer.effect(
  HyperliquidServiceTag,
  Effect.gen(function* () {
    // Get dependencies
    const config = yield* ConfigServiceTag;
    const http = yield* HttpClientTag;

    // Initialize external client
    const client = new HyperliquidSDK({
      baseUrl: config.hyperliquidApiUrl,
    });

    // Return implementation
    return {
      getPortfolio: (address) =>
        Effect.tryPromise({
          try: () => client.info.perpetuals.getClearinghouseState(address),
          catch: (error) =>
            new HyperliquidError({
              code: "FETCH_ERROR",
              message: String(error),
            }),
        }),

      getMarketData: (symbol) =>
        Effect.tryPromise({
          try: () => client.info.perpetuals.getMarketMeta(symbol),
          catch: (error) =>
            new HyperliquidError({
              code: "FETCH_ERROR",
              message: String(error),
            }),
        }),

      subscribePrices: (symbols) =>
        Effect.acquireRelease(
          Effect.sync(() => createPriceStream(symbols)),
          (stream) => Effect.sync(() => stream.close())
        ),
    };
  })
);
```

## Service Examples

### AIService

```typescript
// services/ai.ts
export interface AIService {
  readonly analyzeChart: (context: ChartContext) => Effect.Effect<AIAnalysis, AIError, never>;

  readonly getRecommendation: (
    query: string,
    context: TradeContext
  ) => Effect.Effect<TradeRecommendation, AIError, never>;
}

export class AIServiceTag extends Context.Tag("AIService")<AIServiceTag, AIService>() {}

// services/ai-live.ts
export const AIServiceLive = Layer.effect(
  AIServiceTag,
  Effect.gen(function* () {
    const config = yield* ConfigServiceTag;

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: config.openaiApiKey });

    // Setup caching
    const cache = yield* Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(5),
      lookup: (key: string) => Effect.fail(new Error("Cache miss")),
    });

    return {
      analyzeChart: (context) =>
        Effect.gen(function* () {
          const cacheKey = `chart-${context.symbol}-${context.timeframe}`;

          // Try cache
          const cached = yield* cache.get(cacheKey).pipe(Effect.optionFromOptional);

          if (Option.isSome(cached)) {
            return cached.value as AIAnalysis;
          }

          // Call OpenAI
          const response = yield* Effect.tryPromise({
            try: () =>
              openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: buildChartPrompt(context),
                response_format: { type: "json_object" },
              }),
            catch: (error) =>
              new AIError({
                code: "OPENAI_ERROR",
                message: String(error),
              }),
          }).pipe(
            Effect.retry({
              schedule: Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(3))),
            })
          );

          const analysis = parseAIResponse(response);
          yield* cache.set(cacheKey, analysis);

          return analysis;
        }),

      getRecommendation: (query, context) =>
        Effect.gen(function* () {
          const response = yield* Effect.tryPromise({
            try: () =>
              openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: buildTradePrompt(query, context),
                response_format: { type: "json_object" },
              }),
            catch: (error) =>
              new AIError({
                code: "OPENAI_ERROR",
                message: String(error),
              }),
          });

          return parseTradeRecommendation(response, context);
        }),
    };
  })
);
```

### PortfolioService

```typescript
// services/portfolio.ts
export interface PortfolioService {
  readonly getPositions: (address: string) => Effect.Effect<Position[], PortfolioError, never>;

  readonly recordTrade: (trade: TradeInput) => Effect.Effect<Trade, DatabaseError, never>;

  readonly getTradeHistory: (
    address: string,
    limit?: number
  ) => Effect.Effect<Trade[], DatabaseError, never>;
}

export class PortfolioServiceTag extends Context.Tag("PortfolioService")<
  PortfolioServiceTag,
  PortfolioService
>() {}

// services/portfolio-live.ts
export const PortfolioServiceLive = Layer.effect(
  PortfolioServiceTag,
  Effect.gen(function* () {
    const db = yield* DatabaseServiceTag;
    const hyperliquid = yield* HyperliquidServiceTag;

    return {
      getPositions: (address) =>
        hyperliquid.getPortfolio(address).pipe(Effect.map((portfolio) => portfolio.positions)),

      recordTrade: (trade) =>
        db.query(
          `INSERT INTO trades (id, wallet_address, symbol, direction, 
                              entry_price, size, ai_recommendation, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            trade.walletAddress,
            trade.symbol,
            trade.direction,
            trade.entryPrice,
            trade.size,
            JSON.stringify(trade.aiRecommendation),
            Date.now(),
          ]
        ),

      getTradeHistory: (address, limit = 50) =>
        db.query(
          `SELECT * FROM trades WHERE wallet_address = ? 
           ORDER BY created_at DESC LIMIT ?`,
          [address, limit]
        ),
    };
  })
);
```

### Web3Service

```typescript
// services/web3.ts
export interface Web3Service {
  readonly connect: () => Effect.Effect<ConnectedWallet, WalletConnectionError, never>;

  readonly disconnect: () => Effect.Effect<void, never, never>;

  readonly getConnectedWallet: () => Effect.Effect<Option<ConnectedWallet>, never, never>;

  readonly signMessage: (
    message: string
  ) => Effect.Effect<Signature, UserRejectedError | WalletNotConnectedError, never>;
}

export class Web3ServiceTag extends Context.Tag("Web3Service")<Web3ServiceTag, Web3Service>() {}

// services/web3-live.ts
export const Web3ServiceLive = Layer.effect(
  Web3ServiceTag,
  Effect.gen(function* () {
    const config = yield* ConfigServiceTag;
    const walletState = yield* Ref.make<Option<ConnectedWallet>>(Option.none());

    const wagmiConfig = createConfig({
      chains: [mainnet, arbitrum],
      connectors: [
        injected({ target: "metaMask" }),
        walletConnect({ projectId: config.walletConnectProjectId }),
      ],
    });

    return {
      connect: () =>
        Effect.tryPromise({
          try: async () => {
            const result = await connect(wagmiConfig);
            const wallet: ConnectedWallet = {
              address: result.account,
              chainId: result.chain.id,
              connector: result.connector.id,
            };
            await Effect.runPromise(Ref.set(walletState, Option.some(wallet)));
            return wallet;
          },
          catch: (error) => new WalletConnectionError({ cause: error }),
        }),

      disconnect: () =>
        Effect.tryPromise({
          try: async () => {
            await disconnect(wagmiConfig);
            await Effect.runPromise(Ref.set(walletState, Option.none()));
          },
          catch: () => undefined,
        }).pipe(Effect.catchAll(() => Effect.void)),

      getConnectedWallet: () => Ref.get(walletState),

      signMessage: (message) =>
        Effect.gen(function* () {
          const maybeWallet = yield* Ref.get(walletState);

          const wallet = yield* Option.match(maybeWallet, {
            onNone: () => Effect.fail(new WalletNotConnectedError()),
            onSome: (w) => Effect.succeed(w),
          });

          return yield* Effect.tryPromise({
            try: () => signMessage(wagmiConfig, { message }),
            catch: (error) =>
              error.message?.includes("rejected")
                ? new UserRejectedError({ message: "User rejected signing" })
                : new WalletOperationError({ cause: error }),
          });
        }),
    };
  })
);
```

## Layer Composition

Combine services into application layer:

```typescript
// runtime.ts
const CoreLayer = Layer.mergeAll(ConfigServiceLive, LoggerLive);

const Web3Layer = Web3ServiceLive.pipe(Layer.provide(CoreLayer));

const HyperliquidLayer = HyperliquidServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, HttpClientLive))
);

const AILayer = AIServiceLive.pipe(Layer.provide(Layer.mergeAll(CoreLayer, HttpClientLive)));

const PortfolioLayer = PortfolioServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, DatabaseServiceLive, HyperliquidLayer))
);

export const AppLayer = Layer.mergeAll(
  CoreLayer,
  Web3Layer,
  HyperliquidLayer,
  AILayer,
  PortfolioLayer
);

// Create managed runtime
export const runtime = ManagedRuntime.make(AppLayer);
```

## Using Services in React

```typescript
// hooks/usePortfolio.ts
import { useEffect, useState } from "react";
import { Effect } from "effect";
import { runtime } from "../runtime";

export function usePortfolio(address: string) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const program = Effect.gen(function* () {
      const service = yield* HyperliquidServiceTag;
      return yield* service.getPortfolio(address);
    });

    runtime.runPromise(program).then(setPortfolio, setError);
  }, [address]);

  return { portfolio, error };
}
```

## Error Types

```typescript
// errors/index.ts
import { Data } from "effect";

export class HyperliquidError extends Data.TaggedError("HyperliquidError")<{
  code: "FETCH_ERROR" | "ORDER_ERROR" | "NETWORK_ERROR";
  message: string;
}> {}

export class AIError extends Data.TaggedError("AIError")<{
  code: "OPENAI_ERROR" | "PARSE_ERROR" | "VALIDATION_ERROR" | "RATE_LIMIT";
  message: string;
}> {}

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  code: "QUERY_ERROR" | "CONNECTION_ERROR";
  message: string;
}> {}

export class Web3Error extends Data.TaggedError("Web3Error")<{
  code: "CONNECTION_ERROR" | "SIGNING_ERROR" | "REJECTED";
  message: string;
}> {}
```

## Testing Services

```typescript
// Test with mock layer
const MockHyperliquidService = Layer.succeed(HyperliquidServiceTag, {
  getPortfolio: () =>
    Effect.succeed({
      balance: 50000,
      positions: [],
    }),
  getMarketData: () =>
    Effect.succeed({
      symbol: "BTC",
      markPrice: 67400,
    }),
  subscribePrices: () => Effect.succeed(Stream.empty),
});

const TestRuntime = ManagedRuntime.make(Layer.mergeAll(MockHyperliquidService, AIServiceLive));

// Run test
const result = await TestRuntime.runPromise(program);
```
