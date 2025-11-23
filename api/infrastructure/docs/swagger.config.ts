import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "0xSignal Crypto Analysis API",
      version: "1.0.0",
      description:
        "Quantitative cryptocurrency analysis API using advanced technical indicators and market intelligence",
      contact: {
        name: "0xSignal",
      },
    },
    servers: [
      {
        url: "http://localhost:9006/api",
        description: "Development server",
      },
      {
        url: "https://api.0xsignal.com/api",
        description: "Production server",
      },
    ],
    tags: [
      {
        name: "Health",
        description: "Health check endpoints",
      },
      {
        name: "Analysis",
        description: "Cryptocurrency market analysis endpoints",
      },
      {
        name: "Signals",
        description: "Trading signals and recommendations",
      },
      {
        name: "Chart",
        description: "Historical chart data endpoints",
      },
    ],
    components: {
      schemas: {
        HealthResponse: {
          type: "object",
          properties: {
            status: {
              type: "string",
              example: "ok",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
            uptime: {
              type: "number",
              description: "Server uptime in seconds",
            },
          },
        },
        EnhancedAnalysis: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              example: "btc",
            },
            price: {
              $ref: "#/components/schemas/CryptoPrice",
            },
            quantAnalysis: {
              $ref: "#/components/schemas/QuantitativeAnalysis",
            },
            riskScore: {
              type: "number",
              minimum: 0,
              maximum: 100,
              description: "Quantitative risk score (0-100)",
            },
            recommendation: {
              type: "string",
              enum: ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"],
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
          },
        },
        CryptoPrice: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
            },
            price: {
              type: "number",
            },
            marketCap: {
              type: "number",
            },
            volume24h: {
              type: "number",
            },
            change24h: {
              type: "number",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
          },
        },
        QuantitativeAnalysis: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
            },
            overallSignal: {
              type: "string",
              enum: ["STRONG_BUY", "BUY", "HOLD", "SELL", "STRONG_SELL"],
            },
            confidence: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },
            riskScore: {
              type: "number",
              minimum: 0,
              maximum: 100,
            },
          },
        },
        MarketOverview: {
          type: "object",
          properties: {
            totalAnalyzed: {
              type: "number",
            },
            highRiskAssets: {
              type: "array",
              items: {
                type: "string",
              },
            },
            averageRiskScore: {
              type: "number",
            },
            timestamp: {
              type: "string",
              format: "date-time",
            },
          },
        },
        ChartDataPoint: {
          type: "object",
          properties: {
            time: {
              type: "number",
              description: "Unix timestamp",
            },
            open: {
              type: "number",
            },
            high: {
              type: "number",
            },
            low: {
              type: "number",
            },
            close: {
              type: "number",
            },
            volume: {
              type: "number",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
            },
            requestId: {
              type: "string",
            },
          },
        },
      },
    },
  },
  apis: ["./presentation/http/routes/*.ts", "./presentation/http/server.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
