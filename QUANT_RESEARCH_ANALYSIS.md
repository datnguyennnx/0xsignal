# 0xSignal: Quantitative Trading Platform - Complete Analysis

## Executive Summary

**0xSignal** is a sophisticated crypto trading signal platform that combines:

- **60+ quantitative formulas** across 9 categories
- **Bubble detection algorithms** for risk assessment
- **Real-time market analysis** via CoinGecko API
- **Effect-TS functional architecture** for composability and reliability
- **React frontend** with real-time signal visualization

---

## Architecture Overview

### Tech Stack

```
Frontend:  React + Vite + Effect-TS + TailwindCSS + shadcn/ui
Backend:   Node.js + Effect-TS + Bun runtime
Data:      CoinGecko API (real-time crypto prices)
Monorepo:  Nx workspace with 3 packages (api, app, shared)
```

### Data Flow

```
CoinGecko API
  ↓
HttpService (shared/services/http.ts)
  ↓
CoinGeckoService (fetches top 100 cryptos)
  ↓
MarketAnalysisService (domain/services/market-analysis.ts)
  ├─→ BubbleDetectionService (risk signals)
  └─→ QuantitativeAnalyzer (60+ formulas)
      ├─→ Volatility Indicators
      ├─→ Momentum Indicators
      ├─→ Trend Indicators
      ├─→ Volume Indicators
      ├─→ Oscillators
      ├─→ Risk Metrics
      ├─→ Statistical Analysis
      ├─→ Mean Reversion
      └─→ Composite Scores
  ↓
EnhancedAnalysis (combined bubble + quant)
  ↓
HTTP Server (presentation/http/server.ts)
  ↓
React Frontend (app/src)
```

---

## Quantitative Formula Library

### 1. **Volatility Indicators** (8 formulas)

Located: `api/domain/formulas/volatility/`

| Formula                      | Purpose                       | Key Metrics                               |
| ---------------------------- | ----------------------------- | ----------------------------------------- |
| **Bollinger Bands**          | Price deviation bands         | Upper/Lower/Middle bands, %B, Bandwidth   |
| **ATR** (Average True Range) | Volatility measurement        | True range, smoothed ATR                  |
| **Keltner Channels**         | Volatility-based channels     | Upper/Lower bands based on ATR            |
| **Donchian Channels**        | Breakout detection            | Highest high / Lowest low over N periods  |
| **Historical Volatility**    | Standard deviation of returns | Annualized volatility %                   |
| **Parkinson Volatility**     | High-low range estimator      | More efficient than close-to-close        |
| **Garman-Klass**             | OHLC volatility estimator     | Accounts for opening jumps                |
| **Bollinger Squeeze**        | Low volatility detection      | Identifies consolidation before breakouts |

**Current Usage:**

- Bollinger Bands → Mean reversion signals (%B, bandwidth)
- ATR → Risk sizing and stop-loss placement
- Squeeze Detection → Breakout anticipation

### 2. **Momentum Indicators** (6 formulas)

Located: `api/domain/formulas/momentum/`

| Formula                           | Purpose                  | Key Signals                              |
| --------------------------------- | ------------------------ | ---------------------------------------- |
| **RSI** (Relative Strength Index) | Overbought/oversold      | 0-100 scale (30=oversold, 70=overbought) |
| **MACD**                          | Trend following momentum | Signal line crossovers, histogram        |
| **Stochastic Oscillator**         | Price momentum           | %K and %D lines, divergences             |
| **ROC** (Rate of Change)          | Price velocity           | % change over N periods                  |
| **Momentum**                      | Raw price momentum       | Price - Price[N periods ago]             |
| **Williams %R**                   | Overbought/oversold      | Similar to Stochastic, inverted scale    |

**Current Usage:**

- RSI → Primary momentum score (50% weight in composite)
- RSI Divergence Detection → Reversal signals
- Momentum Score = (RSI × 0.5) + (Volume ROC × 0.25) + (Price Change × 0.25)

### 3. **Trend Indicators** (5 formulas)

Located: `api/domain/formulas/trend/`

| Formula                             | Purpose          | Key Signals                           |
| ----------------------------------- | ---------------- | ------------------------------------- |
| **Moving Averages** (SMA/EMA)       | Trend direction  | Crossovers, slope, support/resistance |
| **ADX** (Average Directional Index) | Trend strength   | 0-100 (>25 = trending)                |
| **Parabolic SAR**                   | Stop and reverse | Trailing stop levels                  |
| **Supertrend**                      | Trend following  | Buy/sell signals based on ATR         |
| **Distance from MA**                | Mean reversion   | % distance from moving average        |

**Current Usage:**

- Distance from MA → Mean reversion score (40% weight)
- Moving averages → Trend context (not yet in composite)

### 4. **Volume Indicators** (6 formulas)

Located: `api/domain/formulas/volume/`

| Formula                                  | Purpose                       | Key Insights                 |
| ---------------------------------------- | ----------------------------- | ---------------------------- |
| **OBV** (On-Balance Volume)              | Cumulative volume flow        | Confirms price trends        |
| **VWAP**                                 | Volume-weighted average price | Intraday benchmark           |
| **MFI** (Money Flow Index)               | Volume-weighted RSI           | Buying/selling pressure      |
| **A/D Line** (Accumulation/Distribution) | Volume flow                   | Accumulation vs distribution |
| **Chaikin Money Flow**                   | Volume-weighted momentum      | 21-period CMF                |
| **Volume ROC**                           | Volume momentum               | % change in volume           |

**Current Usage:**

- Volume ROC → Momentum score (25% weight)
- Volume/Market Cap Ratio → Liquidity assessment

### 5. **Oscillators** (5 formulas)

Located: `api/domain/formulas/oscillators/`

| Formula                              | Purpose                  | Range                  |
| ------------------------------------ | ------------------------ | ---------------------- |
| **CCI** (Commodity Channel Index)    | Overbought/oversold      | Typically ±100         |
| **RVI** (Relative Vigor Index)       | Momentum direction       | -1 to +1               |
| **Ultimate Oscillator**              | Multi-timeframe momentum | 0-100                  |
| **Awesome Oscillator**               | Momentum histogram       | Positive/negative bars |
| **DPO** (Detrended Price Oscillator) | Cycle identification     | Removes trend          |

**Status:** Implemented but not yet integrated into composite scores

### 6. **Risk Metrics** (8 formulas)

Located: `api/domain/formulas/risk/`

| Formula                    | Purpose                       | Interpretation                            |
| -------------------------- | ----------------------------- | ----------------------------------------- |
| **VaR** (Value at Risk)    | Downside risk                 | Maximum expected loss at confidence level |
| **CVaR** (Conditional VaR) | Tail risk                     | Expected loss beyond VaR                  |
| **Maximum Drawdown**       | Peak-to-trough decline        | Worst historical loss                     |
| **Sharpe Ratio**           | Risk-adjusted return          | Return per unit of volatility             |
| **Sortino Ratio**          | Downside risk-adjusted return | Only penalizes downside volatility        |
| **Calmar Ratio**           | Return/drawdown ratio         | Return per unit of max drawdown           |
| **Beta**                   | Market correlation            | Sensitivity to market movements           |
| **Quant Risk Score**       | Composite risk                | 0-100 (BB position + RSI + volatility)    |

**Current Usage:**

- Quant Risk Score → Combined with bubble score (40% weight)
- Risk Score = (BB Risk × 0.3) + (RSI Risk × 0.4) + (Volatility × 0.3)

### 7. **Statistical Analysis** (5 formulas)

Located: `api/domain/formulas/statistical/`

| Formula                | Purpose                | Use Case                           |
| ---------------------- | ---------------------- | ---------------------------------- |
| **Standard Deviation** | Dispersion measure     | Volatility calculation             |
| **Z-Score**            | Standardized deviation | Outlier detection                  |
| **Correlation**        | Relationship strength  | Portfolio diversification          |
| **Covariance**         | Joint variability      | Risk modeling                      |
| **Linear Regression**  | Trend line             | Support/resistance, mean reversion |

**Status:** Implemented but not yet used in main analysis pipeline

### 8. **Mean Reversion** (5 formulas)

Located: `api/domain/formulas/mean-reversion/`

| Formula                  | Purpose                     | Signal                                 |
| ------------------------ | --------------------------- | -------------------------------------- |
| **Percent B** (%B)       | Position in Bollinger Bands | 0=lower band, 1=upper band, 0.5=middle |
| **Bollinger Width**      | Band width %                | Low width = squeeze, high = expansion  |
| **Keltner Width**        | Channel width               | Similar to BB but uses ATR             |
| **Distance from MA**     | % from moving average       | Positive=above, negative=below         |
| **Mean Reversion Score** | Composite MR signal         | Combines %B and MA distance            |

**Current Usage:**

- %B → Mean reversion score (60% weight)
- Distance from MA → Mean reversion score (40% weight)
- MR Score = (%B - 0.5) × 200 × 0.6 + (MA Distance × 10) × 0.4

### 9. **Composite Scores** (3 scores)

Located: `api/domain/formulas/composite-scores.ts`

| Score                    | Components                                              | Output       |
| ------------------------ | ------------------------------------------------------- | ------------ |
| **Momentum Score**       | RSI (50%) + Volume ROC (25%) + Price Change (25%)       | -100 to +100 |
| **Volatility Score**     | BB Width (40%) + Daily Range (40%) + ATH Distance (20%) | 0-100        |
| **Mean Reversion Score** | %B (60%) + Distance from MA (40%)                       | -100 to +100 |

**Signal Generation:**

```typescript
Combined Score = (Momentum × 0.7) + (Mean Reversion × 0.3)

// Adjustments:
+ Bollinger Squeeze boost (±20 points)
+ RSI Divergence boost (±15 points)

// Final Signal:
> 60  → STRONG_BUY
> 20  → BUY
< -60 → STRONG_SELL
< -20 → SELL
else  → HOLD
```

---

## Bubble Detection System

Located: `shared/services/bubble-detection.ts`

### Detection Algorithms

| Signal Type           | Triggers                              | Severity Levels          |
| --------------------- | ------------------------------------- | ------------------------ |
| **PRICE_SPIKE**       | 24h change >20%, Volume >3x normal    | LOW/MEDIUM/HIGH/CRITICAL |
| **VOLUME_SURGE**      | Volume >10% of market cap, >5x normal | MEDIUM/HIGH/CRITICAL     |
| **ATH_APPROACH**      | Price >90% of all-time high           | LOW/MEDIUM/HIGH/CRITICAL |
| **VOLATILITY_SPIKE**  | Volatility >80%, Liquidity <30%       | MEDIUM/HIGH/CRITICAL     |
| **EXTREME_DOMINANCE** | Market cap >$50B, Dominance >15%      | MEDIUM/HIGH/CRITICAL     |

### Bubble Score Calculation

```typescript
Bubble Score = Σ(Signal Confidence × Severity Multiplier × Weight)

Weights:
- PRICE_SPIKE: 35%
- ATH_APPROACH: 30%
- VOLUME_SURGE: 25%
- VOLATILITY_SPIKE: 20%
- EXTREME_DOMINANCE: 15%

Severity Multipliers:
- LOW: 0.3
- MEDIUM: 0.6
- HIGH: 0.8
- CRITICAL: 1.0

Risk Level:
- EXTREME: Score ≥80 or has CRITICAL signals
- HIGH: Score ≥60 or has HIGH signals
- MEDIUM: Score ≥40
- LOW: Score <40
```

---

## Combined Risk Assessment

Located: `api/domain/services/market-analysis.ts`

### Final Recommendation Logic

```typescript
Combined Risk = (Bubble Score × 0.6) + (Quant Risk × 0.4)

Recommendation:
if (Combined Risk >80 || Risk Level = EXTREME) → STRONG_SELL
if (Combined Risk >60 || Risk Level = HIGH) → SELL
if (Combined Risk <30 && Quant Signal = STRONG_BUY/BUY) → STRONG_BUY/BUY
else → HOLD
```

### EnhancedAnalysis Output

```typescript
{
  symbol: string;
  price: CryptoPrice;              // Raw price data
  bubbleAnalysis: {
    isBubble: boolean;
    bubbleScore: 0-100;
    signals: BubbleSignal[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  };
  quantAnalysis: {
    bollingerSqueeze: {...};
    rsiDivergence: {...};
    percentB: number;
    bollingerWidth: number;
    distanceFromMA: number;
    volumeROC: number;
    compositeScores: {
      momentum: {...};
      volatility: {...};
      meanReversion: {...};
      overallQuality: 0-100;
    };
    overallSignal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
    confidence: 0-100;
    riskScore: 0-100;
  };
  combinedRiskScore: 0-100;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
}
```

---

## API Endpoints

Located: `api/presentation/http/server.ts`

| Endpoint                                    | Method | Description                   | Response                        |
| ------------------------------------------- | ------ | ----------------------------- | ------------------------------- |
| `/api/health`                               | GET    | Health check                  | `{ status, timestamp, uptime }` |
| `/api/analysis/top?limit=N`                 | GET    | Top N cryptos analysis        | `EnhancedAnalysis[]`            |
| `/api/analysis/:symbol`                     | GET    | Single crypto analysis        | `EnhancedAnalysis`              |
| `/api/overview`                             | GET    | Market overview               | `MarketOverview`                |
| `/api/signals`                              | GET    | All signals (confidence ≥60%) | `EnhancedAnalysis[]`            |
| `/api/signals/high-confidence?confidence=N` | GET    | High confidence signals       | `EnhancedAnalysis[]`            |

**Caching:** All endpoints cached for 2 minutes (120,000ms)

---

## Frontend Architecture

Located: `app/src/`

### Pages

1. **MarketDashboard** (`/`) - Two-column buy/sell signals
2. **AllBuySignals** (`/buy`) - All buy signals with filtering
3. **AllSellSignals** (`/sell`) - All sell signals with filtering
4. **AssetDetail** (`/asset/:symbol`) - Individual crypto deep dive

### Key Features

- **Effect-TS Integration**: Functional error handling with `Exit` types
- **Real-time Updates**: Manual refresh (no WebSocket yet)
- **Signal Filtering**: By confidence, signal type, risk level
- **Responsive Design**: TailwindCSS + shadcn/ui components

---

## What's Working Well

### ✅ Strengths

1. **Comprehensive Formula Library**
   - 60+ indicators across 9 categories
   - Pure functional implementations
   - Effect-TS for composability

2. **Dual Risk Assessment**
   - Quantitative formulas (technical analysis)
   - Bubble detection (fundamental risk)
   - Combined scoring (60/40 split)

3. **Parallel Processing**
   - All formulas run concurrently via `Effect.all`
   - Efficient batch analysis (50+ cryptos in seconds)

4. **Clean Architecture**
   - Domain-driven design
   - Separation of concerns (domain/application/infrastructure/presentation)
   - Shared types across frontend/backend

5. **Type Safety**
   - Full TypeScript coverage
   - Effect-TS error handling
   - Compile-time guarantees

---

## Critical Gaps for Quant Research

### 🚨 Missing Components

### 1. **Historical Data & Backtesting**

**Problem:** Only analyzing single price points (current snapshot)
**Impact:** Cannot validate signal quality or calculate win rates

**What's Needed:**

```typescript
// Historical price data structure
interface HistoricalData {
  symbol: string;
  timeframe: "1h" | "4h" | "1d" | "1w";
  candles: OHLCV[]; // Open, High, Low, Close, Volume
  startDate: Date;
  endDate: Date;
}

// Backtesting framework
interface BacktestResult {
  symbol: string;
  strategy: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
}
```

**Implementation Path:**

- Add CoinGecko historical data endpoint (`/coins/{id}/market_chart`)
- Store OHLCV data in time-series database (InfluxDB/TimescaleDB)
- Build backtesting engine to replay signals
- Calculate performance metrics per strategy

### 2. **Multi-Timeframe Analysis**

**Problem:** Only analyzing 24h data (single timeframe)
**Impact:** Missing trend context and confirmation

**What's Needed:**

```typescript
interface MultiTimeframeAnalysis {
  symbol: string;
  timeframes: {
    "1h": QuantitativeAnalysis; // Short-term entries
    "4h": QuantitativeAnalysis; // Swing trades
    "1d": QuantitativeAnalysis; // Position trades
    "1w": QuantitativeAnalysis; // Macro trend
  };
  alignment: {
    trendAlignment: "ALIGNED" | "MIXED" | "CONFLICTING";
    confidence: number;
    recommendation: string;
  };
}
```

**Use Cases:**

- **Trend Alignment**: All timeframes bullish = high confidence
- **Entry Timing**: 1h oversold + 1d uptrend = buy opportunity
- **Risk Management**: 1w downtrend = reduce position size

### 3. **Market Regime Detection**

**Problem:** Same signals used in all market conditions
**Impact:** Strategies that work in trending markets fail in ranging markets

**What's Needed:**

```typescript
interface MarketRegime {
  regime: "TRENDING_BULL" | "TRENDING_BEAR" | "RANGING" | "VOLATILE" | "QUIET";
  confidence: number;
  indicators: {
    adx: number; // Trend strength
    bollingerWidth: number; // Volatility
    correlation: number; // Market cohesion
    breadth: number; // % coins above MA
  };
  recommendedStrategies: string[];
}

// Adaptive signal generation
function generateSignal(analysis: QuantitativeAnalysis, regime: MarketRegime) {
  if (regime.regime === "TRENDING_BULL") {
    // Use momentum indicators (RSI, MACD)
    // Ignore mean reversion signals
  } else if (regime.regime === "RANGING") {
    // Use mean reversion (Bollinger Bands, %B)
    // Ignore momentum signals
  }
}
```

**Implementation:**

- Calculate ADX across top 20 cryptos (avg >25 = trending)
- Calculate average Bollinger Width (low = quiet, high = volatile)
- Calculate correlation matrix (high = systemic risk)
- Calculate market breadth (% above 50-day MA)

### 4. **Relative Strength Analysis**

**Problem:** Analyzing cryptos in isolation
**Impact:** Missing sector rotation and relative opportunities

**What's Needed:**

```typescript
interface RelativeStrengthAnalysis {
  symbol: string;
  vsMarket: {
    relativeStrength: number; // vs BTC
    percentile: number; // 0-100 (ranking)
    trend: "OUTPERFORMING" | "UNDERPERFORMING" | "NEUTRAL";
  };
  vsSector: {
    sector: "DeFi" | "L1" | "L2" | "Meme" | "Gaming";
    relativeStrength: number;
    percentile: number;
  };
  leaders: string[]; // Top performers in sector
  laggards: string[]; // Bottom performers
}
```

**Use Cases:**

- **Sector Rotation**: Identify which sectors are gaining capital
- **Pair Trading**: Long strong coins, short weak coins
- **Risk Management**: Avoid weak sectors during downturns

### 5. **Correlation Matrix & Portfolio Analysis**

**Problem:** No understanding of how cryptos move together
**Impact:** Cannot assess diversification or systemic risk

**What's Needed:**

```typescript
interface CorrelationMatrix {
  timestamp: Date;
  period: "7d" | "30d" | "90d";
  correlations: Map<string, Map<string, number>>; // Symbol pairs → correlation
  clusters: {
    name: string;
    members: string[];
    avgCorrelation: number;
  }[];
  systemicRisk: {
    avgCorrelation: number; // Market-wide correlation
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
    insight: string;
  };
}
```

**Use Cases:**

- **Diversification**: Find low-correlation pairs
- **Risk Warning**: High correlation = systemic risk (all fall together)
- **Regime Change**: Rising correlation = risk-off environment

### 6. **Signal Confidence Scoring**

**Problem:** All signals treated equally
**Impact:** Cannot prioritize high-quality setups

**What's Needed:**

```typescript
interface SignalConfidence {
  symbol: string;
  signal: "BUY" | "SELL";
  confidence: number; // 0-100
  factors: {
    confluence: number; // How many indicators agree (0-100)
    strength: number; // How strong is each indicator (0-100)
    reliability: number; // Historical win rate (0-100)
    riskReward: number; // Expected profit/loss ratio
  };
  historicalPerformance: {
    winRate: number;
    avgProfit: number;
    avgLoss: number;
    sampleSize: number;
  };
}
```

**Confluence Calculation:**

```typescript
// Example: BUY signal
const confluence = {
  rsi: rsi < 30 ? 1 : 0, // Oversold
  percentB: percentB < 0.2 ? 1 : 0, // Below lower BB
  macd: macdHistogram > 0 ? 1 : 0, // Bullish crossover
  volume: volumeROC > 50 ? 1 : 0, // Volume surge
  divergence: hasBullishDivergence ? 1 : 0, // RSI divergence
};

const confluenceScore = (Object.values(confluence).reduce((a, b) => a + b) / 5) * 100;
// 5/5 indicators = 100% confluence = high confidence
```

### 7. **Watchlist & Alert System**

**Problem:** No way to track specific setups or get notified
**Impact:** Miss opportunities when they develop

**What's Needed:**

```typescript
interface Watchlist {
  name: string;
  criteria: {
    minConfidence?: number;
    signals?: ("BUY" | "SELL")[];
    indicators?: {
      rsi?: { min?: number; max?: number };
      bollingerSqueeze?: boolean;
      volumeSurge?: boolean;
    };
  };
  assets: string[];
  alerts: Alert[];
}

interface Alert {
  id: string;
  type: "SIGNAL" | "PRICE" | "INDICATOR";
  condition: string;
  triggered: boolean;
  timestamp?: Date;
  notification: "EMAIL" | "WEBHOOK" | "UI";
}
```

**Use Cases:**

- **Breakout Alerts**: Notify when Bollinger Squeeze resolves
- **Reversal Alerts**: Notify when RSI divergence appears
- **Price Alerts**: Notify when price hits key levels

### 8. **Performance Tracking**

**Problem:** No way to measure if signals are profitable
**Impact:** Cannot improve or validate strategies

**What's Needed:**

```typescript
interface PerformanceMetrics {
  strategy: string;
  period: { start: Date; end: Date };
  trades: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
  };
  returns: {
    totalReturn: number;
    avgReturn: number;
    bestTrade: number;
    worstTrade: number;
  };
  risk: {
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    volatility: number;
  };
  bySignalType: Map<string, PerformanceMetrics>;
}
```

---

## Recommended Research Workflow

### Phase 1: Data Foundation (Week 1-2)

1. **Add Historical Data Storage**
   - Integrate CoinGecko historical endpoint
   - Store OHLCV data (1h, 4h, 1d, 1w timeframes)
   - Build data pipeline for continuous updates

2. **Multi-Timeframe Analysis**
   - Calculate indicators across all timeframes
   - Implement trend alignment logic
   - Add timeframe selector to UI

### Phase 2: Market Context (Week 3-4)

3. **Market Regime Detection**
   - Calculate ADX, BB Width, Correlation across top 20
   - Classify regime (trending/ranging/volatile/quiet)
   - Display regime indicator in UI

4. **Relative Strength Analysis**
   - Calculate RS vs BTC for all cryptos
   - Group by sector (DeFi, L1, L2, etc.)
   - Show sector heatmap in UI

5. **Correlation Matrix**
   - Calculate 30-day rolling correlations
   - Identify clusters and systemic risk
   - Visualize correlation heatmap

### Phase 3: Signal Quality (Week 5-6)

6. **Backtesting Engine**
   - Replay historical signals
   - Calculate win rate, profit factor, Sharpe ratio
   - Store results per strategy/indicator

7. **Confidence Scoring**
   - Calculate confluence (indicator agreement)
   - Weight by historical performance
   - Filter signals by min confidence threshold

8. **Watchlist & Alerts**
   - Build watchlist management
   - Implement alert conditions
   - Add notification system (webhook/email)

### Phase 4: Continuous Improvement (Ongoing)

9. **Performance Tracking**
   - Track live signal performance
   - Compare to backtest results
   - Identify degrading strategies

10. **Strategy Optimization**
    - A/B test indicator parameters
    - Optimize weights in composite scores
    - Adapt to changing market conditions

---

## Immediate Action Items

### High Priority (Do First)

1. **Add Historical Data Endpoint**

```typescript
// In CoinGeckoService
getHistoricalData: (symbol: string, days: number) => Effect.Effect<OHLCV[], CoinGeckoError>;
```

2. **Build Market Regime Detector**

```typescript
// New file: api/domain/analysis/market-regime.ts
export const detectMarketRegime = (
  analyses: EnhancedAnalysis[]
): Effect.Effect<MarketRegime>
```

3. **Add Confluence Scoring**

```typescript
// In analyzer.ts
const calculateConfluence = (analysis: QuantitativeAnalysis): number => {
  // Count how many indicators agree with the signal
};
```

4. **Create Market Overview Dashboard**

```typescript
// New page: app/src/pages/MarketOverview.tsx
// Show: Regime, Top Movers, Correlation, Breadth
```

### Medium Priority (Do Next)

5. **Implement Backtesting**
6. **Add Relative Strength Analysis**
7. **Build Watchlist System**
8. **Add Performance Tracking**

### Low Priority (Nice to Have)

9. **Add More Oscillators to Composite**
10. **Implement Statistical Analysis**
11. **Add Machine Learning Models**
12. **Build Custom Strategy Builder**

---

## Key Insights for Quant Research

### What Makes a Good Trading Signal?

1. **Confluence** (Multiple indicators agree)
   - RSI oversold + Bollinger lower band + Volume surge = High confidence
   - Single indicator = Low confidence

2. **Context** (Market regime matters)
   - Momentum signals work in trends
   - Mean reversion works in ranges
   - Wrong strategy in wrong regime = losses

3. **Confirmation** (Multi-timeframe alignment)
   - 1h oversold + 1d uptrend = Buy
   - 1h oversold + 1d downtrend = Avoid

4. **Relative Strength** (Outperformance matters)
   - Strong coin in strong sector = Best opportunity
   - Weak coin in weak sector = Avoid

5. **Risk Management** (Protect capital first)
   - High correlation = Reduce position size
   - High volatility = Wider stops
   - Bubble signals = Exit or avoid

### Current System Strengths

✅ **Comprehensive Indicators**: 60+ formulas cover all aspects
✅ **Dual Risk Assessment**: Quant + Bubble detection
✅ **Functional Architecture**: Composable, testable, reliable
✅ **Real-time Analysis**: Fast parallel processing

### Current System Weaknesses

❌ **No Historical Context**: Single snapshot analysis
❌ **No Backtesting**: Cannot validate signal quality
❌ **No Multi-Timeframe**: Missing trend context
❌ **No Regime Detection**: Same strategy in all conditions
❌ **No Relative Strength**: Analyzing in isolation
❌ **No Performance Tracking**: Cannot measure success

---

## Conclusion

You've built a **solid foundation** with:

- Comprehensive quantitative formula library
- Clean functional architecture
- Real-time market analysis
- Dual risk assessment (quant + bubble)

To become a **complete quant research platform**, you need:

- Historical data & backtesting
- Multi-timeframe analysis
- Market regime detection
- Relative strength analysis
- Signal confidence scoring
- Performance tracking

The architecture is ready to support these features. The next step is **data infrastructure** (historical storage) and **market context** (regime detection, relative strength).

Focus on **Phase 1** (Data Foundation) first, then **Phase 2** (Market Context). This will unlock the ability to validate signals and adapt to market conditions.

---

## Resources for Next Steps

### Data Sources

- **CoinGecko API**: Historical OHLCV data
- **Binance API**: Real-time WebSocket feeds
- **CryptoCompare**: Alternative data source

### Backtesting Libraries

- **Backtrader** (Python): Full-featured backtesting
- **Zipline** (Python): Quantopian's framework
- **Custom Effect-TS**: Build your own (recommended for consistency)

### Time-Series Databases

- **InfluxDB**: Purpose-built for time-series
- **TimescaleDB**: PostgreSQL extension
- **QuestDB**: High-performance TSDB

### Visualization

- **TradingView**: Charting library
- **Recharts**: React charting (already using)
- **D3.js**: Custom visualizations

---

**Next Command:** `tree -I 'node_modules|dist|.nx|.git' -L 5` to explore deeper structure if needed.
