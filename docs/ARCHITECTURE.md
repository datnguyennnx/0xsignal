# 0xSignal Architecture

## Layered Architecture

0xSignal follows clean architecture principles with three distinct layers:

### 1. Domain Layer

Pure business logic, no external dependencies.

```
domain/
  ├── analysis/         # Market analysis logic
  ├── context/          # Context computation
  └── types/            # Domain types and errors
```

### 2. Application Layer

Orchestrates domain logic with infrastructure.

```
application/
  ├── analyze-market.ts
  ├── find-entries.ts
  └── analyze-asset.ts
```

### 3. Infrastructure Layer

External integrations wrapped in Effect services.

```
infrastructure/
  ├── data-sources/     # Provider implementations
  │   ├── coingecko/
  │   ├── binance/
  │   ├── defillama/
  │   └── heatmap/
  ├── http/             # HTTP client, rate limiting
  ├── cache/            # Request caching
  └── config/           # App configuration
```

## Effect-TS Service Pattern

### Service Definition

```typescript
// services/portfolio.ts
import { Effect, Context } from "effect";

export interface PortfolioService {
  readonly getPositions: (address: string) => Effect.Effect<Position[], PortfolioError, never>;

  readonly recordTrade: (trade: TradeInput) => Effect.Effect<Trade, DatabaseError, never>;
}

export class PortfolioServiceTag extends Context.Tag("PortfolioService")<
  PortfolioServiceTag,
  PortfolioService
>() {}
```

### Service Implementation

```typescript
// services/portfolio-live.ts
import { Layer, Effect } from "effect";

export const PortfolioServiceLive = Layer.effect(
  PortfolioServiceTag,
  Effect.gen(function* () {
    const db = yield* DatabaseServiceTag;
    const hyperliquid = yield* HyperliquidServiceTag;

    return {
      getPositions: (address) =>
        hyperliquid.getPortfolio(address).pipe(
          Effect.map((portfolio) => portfolio.positions)
        ),

      recordTrade: (trade) =>
        db.query(
          "INSERT INTO trades ...",
          [trade.walletAddress, trade.symbol, ...]
        )
    };
  })
);
```

## Layer Composition

Layers compose dependencies from bottom-up:

```typescript
// infrastructure/layers/app.layer.ts
const CoreLayer = Layer.mergeAll(DevLoggerLive, AppConfigLive);

const HttpLayer = Layer.mergeAll(HttpClientLive, RateLimiterLive).pipe(Layer.provide(CoreLayer));

const CoinGeckoLayer = CoinGeckoServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, HttpLayer))
);

const BinanceLayer = BinanceServiceLive.pipe(Layer.provide(Layer.mergeAll(CoreLayer, HttpLayer)));

const ContextLayer = ContextServiceLive.pipe(
  Layer.provide(Layer.mergeAll(CoreLayer, HttpLayer, CoinGeckoLayer, BinanceLayer))
);

export const AppLayer = Layer.mergeAll(
  CoreLayer,
  HttpLayer,
  CoinGeckoLayer,
  BinanceLayer,
  ContextLayer
);
```

## Frontend Runtime

Singleton ManagedRuntime pattern:

```typescript
// core/runtime/effect-runtime.ts
const BaseAppLayer = Layer.mergeAll(ApiServiceLive, CacheServiceLive);

let managedRuntime: ManagedRuntime.ManagedRuntime<AppContext, never> | null = null;

export const getAppRuntime = async () => {
  if (!managedRuntime) {
    managedRuntime = ManagedRuntime.make(BaseAppLayer);
  }
  return managedRuntime.runtime();
};

export const runEffect = async <A, E>(effect: Effect.Effect<A, E, AppContext>) => {
  const runtime = await getAppRuntime();
  return Runtime.runPromise(runtime)(effect);
};
```

## New Services Integration

### Hyperliquid Service

```typescript
interface HyperliquidService {
  readonly getPortfolio: (address: string) => Effect.Effect<Portfolio, HyperliquidError, never>;

  readonly getMarketData: (symbol: string) => Effect.Effect<MarketData, HyperliquidError, never>;

  readonly subscribePrices: (
    symbols: string[]
  ) => Effect.Effect<Stream<PriceUpdate>, HyperliquidError, Scope>;
}
```

### AI Service

```typescript
interface AIService {
  readonly analyzeChart: (context: ChartContext) => Effect.Effect<AIAnalysis, AIError, never>;

  readonly getRecommendation: (
    query: string,
    context: TradeContext
  ) => Effect.Effect<TradeRecommendation, AIError, never>;
}
```

### Web3 Service

```typescript
interface Web3Service {
  readonly connect: () => Effect.Effect<ConnectedWallet, WalletConnectionError, never>;

  readonly signMessage: (
    message: string
  ) => Effect.Effect<Signature, UserRejectedError | WalletNotConnectedError, never>;
}
```

## Data Flow

1. **Frontend** → User interactions trigger Effect programs
2. **Runtime** → Executes effects with provided service layer
3. **Services** → Call external APIs (Hyperliquid, OpenAI)
4. **Domain** → Pure functions transform data
5. **Response** → Typed results flow back through layers

## Error Handling

All errors are typed and tracked:

```typescript
export class HyperliquidError extends Data.TaggedError("HyperliquidError")<{
  code: "FETCH_ERROR" | "ORDER_ERROR" | "NETWORK_ERROR";
  message: string;
}> {}

export class AIError extends Data.TaggedError("AIError")<{
  code: "OPENAI_ERROR" | "PARSE_ERROR" | "VALIDATION_ERROR";
  message: string;
}> {}
```

## Caching Strategy

Effect Cache for expensive operations:

```typescript
const cache =
  yield *
  Cache.make({
    capacity: 100,
    timeToLive: Duration.minutes(5),
    lookup: (symbol: string) => fetchMarketData(symbol),
  });

return {
  getMarketData: (symbol) => cache.get(symbol),
};
```
