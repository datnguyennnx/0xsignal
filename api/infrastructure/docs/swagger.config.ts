import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "0xSignal Crypto Analysis API",
      version: "2.0.0",
      description:
        "Quantitative cryptocurrency analysis API with market heatmaps, liquidation data, and derivatives analytics",
      contact: {
        name: "0xSignal",
      },
    },
    servers: [
      {
        url: "http://localhost:9006/api",
        description: "Development server",
      },
    ],
    tags: [
      { name: "Health", description: "Health check endpoints" },
      { name: "Analysis", description: "Cryptocurrency market analysis" },
      { name: "Signals", description: "Trading signals and recommendations" },
      { name: "Chart", description: "Historical chart data" },
      { name: "Heatmap", description: "Market heatmap visualization" },
      { name: "Liquidations", description: "Liquidation data and heatmaps" },
      { name: "Derivatives", description: "Open interest and funding rates" },
      { name: "System", description: "System information" },
    ],
    components: {
      schemas: {
        // Health
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string", example: "ok" },
            timestamp: { type: "string", format: "date-time" },
            uptime: { type: "number", description: "Server uptime in seconds" },
          },
        },

        // Crypto Price
        CryptoPrice: {
          type: "object",
          properties: {
            symbol: { type: "string", example: "btc" },
            price: { type: "number", example: 87000 },
            marketCap: { type: "number" },
            volume24h: { type: "number" },
            change24h: { type: "number", example: 2.5 },
            timestamp: { type: "string", format: "date-time" },
            high24h: { type: "number" },
            low24h: { type: "number" },
            circulatingSupply: { type: "number" },
            ath: { type: "number" },
            athChangePercentage: { type: "number" },
          },
        },

        // Strategy Result
        StrategyResult: {
          type: "object",
          properties: {
            regime: {
              type: "string",
              enum: [
                "BULL_MARKET",
                "BEAR_MARKET",
                "TRENDING",
                "SIDEWAYS",
                "MEAN_REVERSION",
                "LOW_VOLATILITY",
                "HIGH_VOLATILITY",
              ],
            },
            signals: { type: "array", items: { $ref: "#/components/schemas/StrategySignal" } },
            primarySignal: { $ref: "#/components/schemas/StrategySignal" },
            overallConfidence: { type: "number" },
            riskScore: { type: "number" },
          },
        },

        StrategySignal: {
          type: "object",
          properties: {
            strategy: { type: "string" },
            signal: { type: "string", enum: ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"] },
            confidence: { type: "number" },
            reasoning: { type: "string" },
            metrics: { type: "object", additionalProperties: { type: "number" } },
          },
        },

        // Crash Signal
        CrashSignal: {
          type: "object",
          properties: {
            isCrashing: { type: "boolean" },
            severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "EXTREME"] },
            confidence: { type: "number" },
            indicators: {
              type: "object",
              properties: {
                rapidDrop: { type: "boolean" },
                volumeSpike: { type: "boolean" },
                oversoldExtreme: { type: "boolean" },
                highVolatility: { type: "boolean" },
              },
            },
            recommendation: { type: "string" },
          },
        },

        // Entry Signal
        EntrySignal: {
          type: "object",
          properties: {
            isOptimalEntry: { type: "boolean" },
            strength: { type: "string", enum: ["WEAK", "MODERATE", "STRONG", "VERY_STRONG"] },
            confidence: { type: "number" },
            entryPrice: { type: "number" },
            targetPrice: { type: "number" },
            stopLoss: { type: "number" },
            recommendation: { type: "string" },
          },
        },

        // Asset Analysis
        AssetAnalysis: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            price: { $ref: "#/components/schemas/CryptoPrice" },
            strategyResult: { $ref: "#/components/schemas/StrategyResult" },
            crashSignal: { $ref: "#/components/schemas/CrashSignal" },
            entrySignal: { $ref: "#/components/schemas/EntrySignal" },
            overallSignal: {
              type: "string",
              enum: ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"],
            },
            confidence: { type: "number" },
            riskScore: { type: "number" },
            recommendation: { type: "string" },
          },
        },

        // Trading Signal
        TradingSignal: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            signal: { type: "string", enum: ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"] },
            confidence: { type: "number" },
            riskScore: { type: "number" },
            regime: { type: "string" },
            recommendation: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
          },
        },

        // Market Overview
        MarketOverview: {
          type: "object",
          properties: {
            totalAnalyzed: { type: "number" },
            highRiskAssets: { type: "array", items: { type: "string" } },
            averageRiskScore: { type: "number" },
            timestamp: { type: "string", format: "date-time" },
          },
        },

        // Chart Data
        ChartDataPoint: {
          type: "object",
          properties: {
            time: { type: "number", description: "Unix timestamp in seconds" },
            open: { type: "number" },
            high: { type: "number" },
            low: { type: "number" },
            close: { type: "number" },
            volume: { type: "number" },
          },
        },

        // Heatmap
        HeatmapCell: {
          type: "object",
          required: ["symbol", "price", "change24h", "marketCap"],
          properties: {
            symbol: { type: "string", example: "btc" },
            name: { type: "string", example: "BTC" },
            price: { type: "number", example: 87000 },
            change24h: { type: "number", example: 2.5 },
            change7d: { type: "number" },
            marketCap: { type: "number" },
            volume24h: { type: "number" },
            category: {
              type: "string",
              enum: [
                "Layer 1",
                "Layer 2",
                "DeFi",
                "Meme",
                "Oracle",
                "Exchange",
                "Payment",
                "Storage",
                "AI",
                "Other",
              ],
            },
            intensity: {
              type: "number",
              minimum: -100,
              maximum: 100,
              description: "Normalized intensity (-100 to 100)",
            },
          },
        },

        HeatmapConfig: {
          type: "object",
          properties: {
            metric: {
              type: "string",
              enum: ["change24h", "change7d", "volume", "marketCap"],
              default: "change24h",
            },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 100 },
            category: { type: "string" },
            sortBy: {
              type: "string",
              enum: ["marketCap", "volume", "change"],
              default: "marketCap",
            },
          },
        },

        MarketHeatmap: {
          type: "object",
          required: ["cells", "timestamp"],
          properties: {
            cells: { type: "array", items: { $ref: "#/components/schemas/HeatmapCell" } },
            totalMarketCap: { type: "number" },
            totalVolume24h: { type: "number" },
            btcDominance: { type: "number", minimum: 0, maximum: 100 },
            ethDominance: { type: "number", minimum: 0, maximum: 100 },
            fearGreedIndex: { type: "number", minimum: 0, maximum: 100 },
            timestamp: { type: "string", format: "date-time" },
          },
        },

        // Liquidation
        LiquidationData: {
          type: "object",
          required: [
            "symbol",
            "totalLiquidations",
            "totalLiquidationUsd",
            "timestamp",
            "timeframe",
          ],
          properties: {
            symbol: { type: "string", example: "BTC" },
            longLiquidations: { type: "integer", minimum: 0 },
            shortLiquidations: { type: "integer", minimum: 0 },
            totalLiquidations: { type: "integer", minimum: 0 },
            longLiquidationUsd: { type: "number", minimum: 0 },
            shortLiquidationUsd: { type: "number", minimum: 0 },
            totalLiquidationUsd: { type: "number", minimum: 0 },
            liquidationRatio: { type: "number", description: "Long/Short ratio" },
            timestamp: { type: "string", format: "date-time" },
            timeframe: { type: "string", enum: ["1h", "4h", "12h", "24h"] },
          },
        },

        LiquidationLevel: {
          type: "object",
          properties: {
            price: { type: "number" },
            longLiquidationUsd: { type: "number" },
            shortLiquidationUsd: { type: "number" },
            totalUsd: { type: "number" },
            intensity: { type: "number" },
          },
        },

        LiquidationHeatmap: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            levels: { type: "array", items: { $ref: "#/components/schemas/LiquidationLevel" } },
            currentPrice: { type: "number" },
            highestLiquidationPrice: { type: "number" },
            lowestLiquidationPrice: { type: "number" },
            totalLongLiquidationUsd: { type: "number" },
            totalShortLiquidationUsd: { type: "number" },
            timestamp: { type: "string", format: "date-time" },
          },
        },

        MarketLiquidationSummary: {
          type: "object",
          required: ["totalLiquidations24h", "totalLiquidationUsd24h", "timestamp"],
          properties: {
            totalLiquidations24h: { type: "integer", minimum: 0 },
            totalLiquidationUsd24h: { type: "number", minimum: 0 },
            longLiquidationUsd24h: { type: "number", minimum: 0 },
            shortLiquidationUsd24h: { type: "number", minimum: 0 },
            largestLiquidation: {
              oneOf: [{ $ref: "#/components/schemas/LiquidationEvent" }, { type: "null" }],
            },
            topLiquidatedSymbols: {
              type: "array",
              items: { $ref: "#/components/schemas/LiquidationData" },
            },
            timestamp: { type: "string", format: "date-time" },
          },
        },

        LiquidationEvent: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            side: { type: "string", enum: ["LONG", "SHORT"] },
            quantity: { type: "number" },
            price: { type: "number" },
            usdValue: { type: "number" },
            timestamp: { type: "string", format: "date-time" },
            exchange: { type: "string" },
          },
        },

        // Derivatives
        OpenInterestData: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            openInterest: { type: "number" },
            openInterestUsd: { type: "number" },
            change24h: { type: "number" },
            changePercent24h: { type: "number" },
            timestamp: { type: "string", format: "date-time" },
          },
        },

        FundingRateData: {
          type: "object",
          properties: {
            symbol: { type: "string" },
            fundingRate: { type: "number", description: "Funding rate in percentage" },
            nextFundingTime: { type: "string", format: "date-time" },
            predictedRate: { type: "number" },
            timestamp: { type: "string", format: "date-time" },
          },
        },

        // Data Sources
        AdapterInfo: {
          type: "object",
          properties: {
            name: { type: "string" },
            version: { type: "string" },
            capabilities: {
              type: "object",
              properties: {
                spotPrices: { type: "boolean" },
                futuresPrices: { type: "boolean" },
                liquidations: { type: "boolean" },
                openInterest: { type: "boolean" },
                fundingRates: { type: "boolean" },
                heatmap: { type: "boolean" },
                historicalData: { type: "boolean" },
                realtime: { type: "boolean" },
              },
            },
            rateLimit: {
              type: "object",
              properties: {
                requestsPerMinute: { type: "number" },
              },
            },
          },
        },

        // Error
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            requestId: { type: "string" },
          },
        },
      },
    },
  },
  apis: ["./presentation/http/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
