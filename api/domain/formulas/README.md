# Quantitative Formulas

This directory contains quantitative finance formulas organized by category, implemented using functional programming with Effect-TS.

## Structure

```
formulas/
├── volatility/          # Volatility-based formulas
│   ├── bollinger-bands.ts
│   └── index.ts
├── momentum/            # Momentum-based formulas
│   ├── rsi.ts
│   └── index.ts
├── analyzer.ts          # Multi-indicator analyzer
└── index.ts
```

## Categories

### 1. Volatility (`/volatility`)

Formulas that measure market volatility and price deviation:

- **Bollinger Bands**: Standard deviation bands around moving average
  - `calculateBollingerBands()` - Pure calculation
  - `computeBollingerBands()` - Effect-based wrapper
  - `detectBollingerSqueeze()` - Squeeze detection (low volatility periods)

### 2. Momentum (`/momentum`)

Formulas that measure price momentum and trend strength:

- **RSI (Relative Strength Index)**: Overbought/oversold indicator
  - `calculateRSI()` - Pure calculation
  - `computeRSI()` - Effect-based wrapper
  - `detectRSIDivergence()` - Divergence detection (reversal signals)

## Usage

### Basic Formula Usage

```typescript
import { Effect } from "effect";
import { computeBollingerBands, computeRSI } from "./formulas";

// Single formula
const bbAnalysis = Effect.runSync(
  computeBollingerBands(cryptoPrice)
);

// Multiple formulas in parallel
const analysis = Effect.gen(function* () {
  const [bb, rsi] = yield* Effect.all([
    computeBollingerBands(price),
    computeRSI(price),
  ], { concurrency: "unbounded" });
  
  return { bb, rsi };
});
```

### Multi-Indicator Analysis

```typescript
import { analyzeWithFormulas, analyzeBatch } from "./formulas/analyzer";

// Single asset
const result = Effect.runSync(
  analyzeWithFormulas(cryptoPrice)
);

// Multiple assets
const results = Effect.runSync(
  analyzeBatch([price1, price2, price3])
);
```

## Principles

1. **Pure Functions**: All calculations are pure (no side effects)
2. **Effect-TS**: Wrapped in Effect for composability
3. **Functional**: Immutable data, function composition
4. **Parallel**: Use `Effect.all` with `concurrency: "unbounded"`
5. **Type-Safe**: Full TypeScript type safety

## Adding New Formulas

1. Create category folder if needed (e.g., `/trend`, `/volume`)
2. Create formula file with pure functions
3. Add Effect-based wrappers
4. Export from category `index.ts`
5. Update main `index.ts`
6. Integrate into `analyzer.ts` if needed

## References

- Bollinger Bands: John Bollinger (1980s)
- RSI: J. Welles Wilder Jr. (1978)
- Effect-TS: https://effect.website
