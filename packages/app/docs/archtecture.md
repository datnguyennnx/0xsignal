# Frontend Architecture & Core Mechanics

> **System:** `@0xsignal/app`
> **Stack:** React 19, TypeScript, Effect-TS, Vite, TailwindCSS
> **Paradigm:** Functional Programming (Pure Domain, Managed Side-Effects)

---

## 1. Architectural Layers

The application is structured into four distinct layers to enforce separation of concerns and functional purity.

```mermaid
graph TD
    subgraph "Layer 1: Presentation (React 19)"
        UI[UI Components]
        Pages[Feature Pages]
        Layout[App Layout]
        style UI fill:#61dafb,stroke:#333,stroke-width:2px,color:black
        style Pages fill:#61dafb,stroke:#333,stroke-width:2px,color:black
    end

    subgraph "Layer 2: Domain (Pure TS)"
        Hooks[Custom Hooks]
        Calc[Memoized Calculations]
        Schema[Zod/Effect Schema]
        style Hooks fill:#ffcfba,stroke:#333,stroke-width:2px,color:black
        style Calc fill:#ffcfba,stroke:#333,stroke-width:2px,color:black
        style Schema fill:#ffcfba,stroke:#333,stroke-width:2px,color:black
    end

    subgraph "Layer 3: Runtime (Effect-TS)"
        Query[Runtime Hooks]
        Fiber[Effect Fibers]
        Resilience[Retry/Timeout Policies]
        style Query fill:#aaffaa,stroke:#333,stroke-width:2px,color:black
        style Fiber fill:#aaffaa,stroke:#333,stroke-width:2px,color:black
        style Resilience fill:#aaffaa,stroke:#333,stroke-width:2px,color:black
    end

    subgraph "Layer 4: Data & Compute"
        Cache["LRU Cache (Effect)"]
        Worker[Web Workers]
        Network[REST / WebSocket]
        style Cache fill:#eebbff,stroke:#333,stroke-width:2px,color:black
        style Worker fill:#eebbff,stroke:#333,stroke-width:2px,color:black
        style Network fill:#eebbff,stroke:#333,stroke-width:2px,color:black
    end

    UI --> Hooks
    Pages --> Hooks
    Hooks --> Calc
    Hooks --> Query
    Query --> Fiber
    Fiber --> Resilience
    Resilience --> Cache
    Resilience --> Worker
    Resilience --> Network

    Worker -.-> |Async Result| Fiber
    Network -.-> |JSON| Cache
    Cache -.-> |Hit/Miss| Fiber
    Fiber -- "Exit<Success, Cause>" --> Query
    Query -- "State Update" --> UI
```

---

## 2. Directory Structure (Feature-Based)

We adopt a "screaming architecture" where top-level folders represent features, not technical types.

```text
packages/app/src/
├── core/                   # Shared technical foundation
│   ├── cache/              # Effect-TS Cache implementations
│   ├── runtime/            # React <-> Effect bridges (hooks)
│   ├── utils/              # Pure utility functions
│   └── workers/            # Legacy/Shared workers
├── features/               # Feature domains
│   ├── chart/              # Charts, Indicators, Drawing Tools
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── ict/            # ICT Concepts Logic (Inner Domain)
│   │   └── wyckoff/        # Wyckoff Logic (Inner Domain)
│   ├── dashboard/          # Market Dashboard
│   ├── asset-detail/       # Asset specific views
│   └── error/              # Error boundaries
└── components/             # Generic UI Kit (Buttons, Cards)
```

---

## 3. Core Mechanics: The React-Effect Bridge

The heart of our performance and reliability lies in how we bridge React's lifecycle with Effect's Runtime. We rarely write `useEffect` manually. Instead, we use specialized hooks.

### 3.1 `useEffectQuery` (The Bridge)

Connects a component to a `Fiber`.

- **Mount**: Spawns a fiber via `Runtime.runFork`.
- **Deps Change**: Interrupts old fiber, starts new one.
- **Unmount**: Interrupts fiber to cancel network/compute.

### 3.2 `useConcurrentQueries` (The Accelerator)

Solves the "N+1 Problem" by batching Effects.

- **Input**: A map of Effect creators (e.g., `{ btc: () => fetch(), eth: () => fetch() }`).
- **Execution**: Uses `Effect.all(effects, { concurrency: 'unbounded' })` to execute all in parallel efficiently.
- **Output**: Updates React state once with all results.

---

## 4. Sequence Diagrams: Optimization Flows

### 4.1 Concurrent Data Fetching (Market Dashboard)

How we load 12+ sparkline charts instantly without freezing the UI.

```mermaid
sequenceDiagram
    participant Dash as MarketDashboard (UI)
    participant Hook as useConcurrentQueries
    participant Cache as Effect Cache
    participant API as Network

    Note over Dash: 1. Calculate list of visible assets
    Dash->>Hook: Call(queries: {BTC, ETH, SOL...})

    activate Hook
    Note over Hook: 2. Spawn Single Fiber

    par Parallel Execution
        Hook->>Cache: Get Chart(BTC)
        Hook->>Cache: Get Chart(ETH)
        Hook->>Cache: Get Chart(SOL)
        Hook->>Cache: Get Chart(BNB)
    end

    Note over Cache: 3. Deduplication (Request Coalescing)

    opt Cache Miss
        Cache->>API: Fetch API (Concurrent)
        API-->>Cache: Response
    end

    Cache-->>Hook: All Data Ready
    deactivate Hook

    Hook->>Dash: 4. Batch State Update

    loop Render Cards
        Dash->>Dash: TradeSetupCard(data=BTC)
        Dash->>Dash: TradeSetupCard(data=ETH)
    end
```

### 4.2 Web Worker Offloading (Heavy Compute)

How we keep the UI "blazing fast" while calculating complex indicators (ICT, Wyckoff).

```mermaid
sequenceDiagram
    participant Chart as TradingChart
    participant Hook as useICTWorker
    participant Worker as ict.worker.ts

    Chart->>Hook: Price Data Changed
    Hook->>Worker: postMessage(ANALYZE, { candles, settings })

    activate Worker
    Note over Worker: Pure Calculation
    Note over Worker: 1. Find Swings
    Note over Worker: 2. Identify FVG
    Note over Worker: 3. Detect OrderBlocks
    Worker-->>Hook: postMessage(RESULT, { analysis })
    deactivate Worker

    Hook->>Chart: setState(analysis)
    Chart->>Chart: Draw Overlays
```

---

## 5. Coding Standards & Principles

### Functional Purity

- **Components**: Should be pure functions of their props. Avoid internal state unless it's strictly UI state (e.g., "isDropdownOpen").
- **Logic**: Extract complex logic into pure functions in `utils` or `logic` files. Test these in isolation.

### Effect-TS Usage

- **No Promise**: Avoid raw `Promise` or `async/await` in domain logic. Use `Effect`.
- **Error Handling**: Use `Effect<Success, Error>` to strongly type errors.
- **Resilience**: Wrap network calls with `Effect.retry` (exponential backoff) and `Effect.timeout`.

### Performance Rules

1.  **No N+1**: Use `useConcurrentQueries` for lists.
2.  **Memoize**: Rely on React Compiler, but use `memo` for list items (`SignalCard`).
3.  **Virtualize**: If a list is > 50 items, use virtualization (though currently we limit via `useResponsiveDataCount`).
4.  **Offload**: Anything taking > 5ms goes to a Web Worker.

---

## 6. CSS & Design System

- **Engine**: TailwindCSS (Utility-first).
- **Theming**: CSS Variables defined in `index.css` (`--background`, `--foreground`).
- **Animations**: Custom keyframes (`animate-in`, `slide-in-from-bottom`) with `ease-premium` curves.

```css
/* Example: Premium Ease */
.ease-premium {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}
```
