# 0xSignal Migration Plan

Migration from complex signal platform to AI Trading Copilot.

## Phase 1: Cleanup (Week 1-2)

### Remove Unused Pages

```bash
# Delete pages
rm -rf packages/app/src/pages/buy.tsx
rm -rf packages/app/src/pages/sell.tsx
rm -rf packages/app/src/pages/hold.tsx
rm -rf packages/app/src/pages/revenue.tsx
rm -rf packages/app/src/pages/treasury.tsx
rm -rf packages/app/src/pages/market-depth.tsx

# Delete related features
rm -rf packages/app/src/features/buyback
rm -rf packages/app/src/features/treasury
rm -rf packages/app/src/features/heatmap
rm -rf packages/app/src/features/signals
```

### Simplify Routing

```typescript
// routes.tsx
const routes = [
  { path: '/', element: <WatchlistPage /> },
  { path: '/chart/:symbol', element: <ChartCopilotPage /> },
  { path: '/portfolio', element: <PortfolioPage /> },
];
```

### Remove Backend Services

```bash
# Delete complex domain logic
rm -rf packages/api/domain/analysis
rm -rf packages/api/domain/buyback
rm -rf packages/api/domain/treasury
rm -rf packages/api/domain/heatmap

# Delete services
rm -rf packages/api/services/buyback.ts
rm -rf packages/api/services/context.ts
rm -rf packages/api/services/analysis.ts
```

### Remove Dependencies

```bash
cd packages/app
bun remove recharts echarts

cd packages/api
# Keep Effect-TS - it's the right tool for the job
```

## Phase 2: Web3 Foundation (Week 2-3)

### Install Dependencies

```bash
cd packages/app
bun add wagmi viem @rainbow-me/rainbowkit
```

### Create Web3 Config

```typescript
// config/web3.ts
import { createConfig, http } from "wagmi";
import { mainnet, arbitrum } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [mainnet, arbitrum],
  connectors: [
    injected({ target: "metaMask" }),
    walletConnect({ projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID }),
  ],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
  },
});
```

### Create Services

```typescript
// services/web3.ts - Service interface
// services/web3-live.ts - wagmi implementation
// services/hyperliquid.ts - Service interface
// services/hyperliquid-live.ts - SDK implementation
```

### Update App Entry

```typescript
// main.tsx
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './config/web3';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WagmiProvider config={wagmiConfig}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>
);
```

## Phase 3: Hyperliquid Integration (Week 3-4)

### Install SDK

```bash
cd packages/app
bun add hyperliquid-sdk
```

### Implement Services

Following existing Effect-TS patterns:

```typescript
// services/hyperliquid.ts
export class HyperliquidServiceTag extends Context.Tag("HyperliquidService")<
  HyperliquidServiceTag,
  HyperliquidService
>() {}

// services/hyperliquid-live.ts
export const HyperliquidServiceLive = Layer.effect(
  HyperliquidServiceTag,
  Effect.gen(function* () {
    const client = new Hyperliquid({ baseUrl: "https://api.hyperliquid.xyz" });

    return {
      getPortfolio: (address) =>
        Effect.tryPromise({
          try: () => client.info.perpetuals.getClearinghouseState(address),
          catch: (error) => new HyperliquidError({ message: String(error) }),
        }),

      getMarketData: (symbol) =>
        Effect.tryPromise({
          try: () => client.info.perpetuals.getMarketMeta(symbol),
          catch: (error) => new HyperliquidError({ message: String(error) }),
        }),
    };
  })
);
```

### Create Hooks

```typescript
// hooks/useHyperliquid.ts
export function useHyperliquidPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const program = Effect.gen(function* () {
      const service = yield* HyperliquidServiceTag;
      const stream = yield* service.subscribePrices(symbols);

      yield* stream.pipe(
        Stream.runForEach((update) =>
          Effect.sync(() => {
            setPrices((prev) => ({ ...prev, [update.symbol]: update.price }));
          })
        )
      );
    });

    const fiber = Effect.runFork(program.pipe(Effect.provide(AppLayer)));
    return () => Effect.runPromise(Fiber.interrupt(fiber));
  }, [symbols]);

  return prices;
}
```

### Build Watchlist Page

```typescript
// pages/watchlist.tsx
export function WatchlistPage() {
  const { isConnected } = useAccount();
  const prices = useHyperliquidPrices(['BTC', 'ETH', 'SOL']);

  return (
    <div>
      {!isConnected && <ConnectWalletPrompt />}
      <PricesTable prices={prices} />
    </div>
  );
}
```

## Phase 4: AI Copilot (Week 4-5)

### Create AI Service

```typescript
// services/ai.ts
export interface AIService {
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
    const openai = new OpenAI({ apiKey: config.openaiApiKey });

    return {
      getRecommendation: (query, context) =>
        Effect.tryPromise({
          try: () =>
            openai.chat.completions.create({
              model: "gpt-4-turbo-preview",
              messages: buildPrompt(query, context),
              response_format: { type: "json_object" },
            }),
          catch: (error) => new AIError({ message: String(error) }),
        }).pipe(Effect.map((response) => parseRecommendation(response))),
    };
  })
);
```

### Build Chat Interface

```typescript
// features/ai-copilot/ChatPanel.tsx
export function ChatPanel({ symbol }: { symbol: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const runtime = useRuntime();

  const sendMessage = async () => {
    const program = Effect.gen(function* () {
      const ai = yield* AIServiceTag;
      const portfolio = yield* PortfolioServiceTag;
      const hyperliquid = yield* HyperliquidServiceTag;

      const [marketData, portfolioData] = yield* Effect.all([
        hyperliquid.getMarketData(symbol),
        portfolio.getAIContext(address)
      ]);

      return yield* ai.getRecommendation(input, {
        chart: getChartContext(symbol),
        market: marketData,
        portfolio: portfolioData
      });
    });

    const result = await runtime.runPromise(program);
    setMessages(prev => [...prev, { type: 'ai', content: result }]);
  };

  return (
    <div className="flex flex-col h-full">
      <MessageList messages={messages} />
      <Input value={input} onSubmit={sendMessage} />
    </div>
  );
}
```

## Phase 5: Portfolio & Backend (Week 5-6)

### Create Simple Backend

```bash
mkdir -p packages/backend
cd packages/backend
bun init
bun add elysia @elysiajs/cors effect
```

### Database Schema

```typescript
// backend/schema.ts
import { Database } from "bun:sqlite";

const db = new Database("portfolio.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    symbol TEXT NOT NULL,
    direction TEXT NOT NULL,
    entry_price REAL NOT NULL,
    exit_price REAL,
    size REAL NOT NULL,
    ai_recommendation TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
```

### API Routes

```typescript
// backend/index.ts
import { Elysia } from "elysia";
import { Effect } from "effect";

const app = new Elysia()
  .get("/portfolio/:address", async ({ params }) => {
    const program = Effect.gen(function* () {
      const service = yield* HyperliquidServiceTag;
      return yield* service.getPortfolio(params.address);
    });
    return runtime.runPromise(program);
  })
  .post("/ai/recommend", async ({ body }) => {
    const program = Effect.gen(function* () {
      const ai = yield* AIServiceTag;
      return yield* ai.getRecommendation(body.query, body.context);
    });
    return runtime.runPromise(program);
  })
  .listen(3001);
```

## Phase 6: Refinement (Week 6-7)

### Simplify Chart

Remove complexity, keep ICT only:

```typescript
// features/chart/TradingChart.tsx
export function TradingChart({ symbol }: { symbol: string }) {
  return (
    <ChartContainer>
      <PriceChart symbol={symbol} />
      <ICTOverlay symbol={symbol} />  {/* Keep only ICT */}
    </ChartContainer>
  );
}
```

### Update Layer Composition

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

export const runtime = ManagedRuntime.make(AppLayer);
```

### Testing Checklist

- [ ] Wallet connection flow
- [ ] Price streaming
- [ ] AI recommendations
- [ ] Trade recording
- [ ] Portfolio display

## Files to Delete (~50 files)

```
packages/
  app/src/pages/buy.tsx
  app/src/pages/sell.tsx
  app/src/pages/hold.tsx
  app/src/pages/revenue.tsx
  app/src/pages/treasury.tsx
  app/src/pages/market-depth.tsx
  app/src/features/buyback/
  app/src/features/treasury/
  app/src/features/heatmap/
  app/src/features/signals/
  api/application/analyze-market.ts
  api/domain/analysis/
  api/domain/buyback/
  api/domain/treasury/
  api/domain/heatmap/
  api/services/buyback.ts
  api/services/context.ts
  api/services/analysis.ts
```

## Files to Create (~30 files)

```
packages/
  app/src/
    config/web3.ts
    services/web3.ts
    services/web3-live.ts
    services/hyperliquid.ts
    services/hyperliquid-live.ts
    services/ai.ts
    services/ai-live.ts
    services/portfolio.ts
    services/portfolio-live.ts
    hooks/useWallet.ts
    hooks/usePortfolio.ts
    hooks/useHyperliquid.ts
    hooks/useAI.ts
    pages/watchlist.tsx
    pages/chart-copilot.tsx
    pages/portfolio.tsx
    features/ai-copilot/
    components/wallet/
  backend/
    index.ts
    schema.ts
    runtime.ts
```

## Timeline

| Phase       | Duration | Deliverable        |
| ----------- | -------- | ------------------ |
| Cleanup     | Week 1-2 | Removed old code   |
| Web3        | Week 2-3 | Wallet connected   |
| Hyperliquid | Week 3-4 | Live prices        |
| AI Copilot  | Week 4-5 | AI recommendations |
| Portfolio   | Week 5-6 | Trade tracking     |
| Polish      | Week 6-7 | Production ready   |

**Total: 7 weeks**
