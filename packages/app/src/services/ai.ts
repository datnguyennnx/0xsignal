// AI Service - Backend API integration with WebSocket streaming support

export interface ChartContext {
  symbol: string;
  timeframe: string;
  priceData: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  currentPrice: number;
}

export interface TradeContext {
  symbol: string;
  position?: {
    side: "long" | "short";
    size: number;
    entryPrice: number;
  };
  accountValue: number;
  riskTolerance: "conservative" | "moderate" | "aggressive";
}

export interface AIAnalysis {
  marketStructure: string;
  trend: "bullish" | "bearish" | "neutral";
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  observations: string[];
  sentiment: "very_bullish" | "bullish" | "neutral" | "bearish" | "very_bearish";
}

export interface TradeRecommendation {
  recommendation: "buy" | "sell" | "hold" | "close";
  confidence: number;
  entryZone: { min: number; max: number };
  stopLoss: number;
  targets: { price: number; probability: number }[];
  reasoning: string;
  ictAnalysis: {
    fairValueGap?: { top: number; bottom: number };
    orderBlock?: { price: number; type: "bullish" | "bearish" };
    liquiditySweep: boolean;
    marketStructureShift: boolean;
  };
}

export interface AIStreamMessage {
  type: "connected" | "started" | "chunk" | "complete" | "error";
  content?: string;
  symbol?: string;
  clientId?: string;
  timestamp: number;
}

export class AIError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AIError";
  }
}

export class AIStreamingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIStreamingError";
  }
}

const API_BASE = import.meta.env.DEV ? "/api" : "http://localhost:9006/api";
const WS_BASE = import.meta.env.DEV
  ? `ws://${window.location.host}/ws/ai`
  : "ws://localhost:9006/ws/ai";

// Model selection types
export interface ModelSelection {
  provider: "openai" | "anthropic" | "google";
  modelId: string;
}

export interface FrontendModel {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  reasoning: boolean;
  costInput: number;
  costOutput: number;
  contextWindow: number;
}

export interface FrontendProvider {
  id: string;
  name: string;
  models: FrontendModel[];
}

export interface ModelsResponse {
  providers: FrontendProvider[];
}

// API functions
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new AIError(error.error || `HTTP ${response.status}`, String(response.status));
  }

  return response.json();
}

export const ai = {
  getModels: async (): Promise<ModelsResponse> => {
    const response = await fetch(`${API_BASE}/models`);
    if (!response.ok) {
      throw new AIError("Failed to load models", String(response.status));
    }
    return response.json();
  },

  analyzeChart: async (context: ChartContext, model?: ModelSelection): Promise<AIAnalysis> => {
    return postJson<AIAnalysis>(`${API_BASE}/ai/analyze`, { ...context, model });
  },

  getRecommendation: async (
    query: string,
    context: TradeContext,
    model?: ModelSelection
  ): Promise<TradeRecommendation> => {
    return postJson<TradeRecommendation>(`${API_BASE}/ai/recommend`, {
      query,
      ...context,
      model,
    });
  },

  clearCache: async (symbol: string, timeframe: string): Promise<void> => {
    await postJson(`${API_BASE}/ai/cache/clear`, { symbol, timeframe });
  },

  // WebSocket streaming
  createStream: (
    context: ChartContext,
    callbacks: {
      onConnect?: () => void;
      onStart?: () => void;
      onChunk?: (content: string) => void;
      onComplete?: () => void;
      onError?: (error: string) => void;
    }
  ) => {
    const ws = new WebSocket(WS_BASE);
    let isActive = true;

    ws.onopen = () => {
      console.log("[AI Stream] Connected");
      // Send analysis request
      ws.send(
        JSON.stringify({
          type: "start_analysis",
          symbol: context.symbol,
          timeframe: context.timeframe,
          priceData: context.priceData,
          currentPrice: context.currentPrice,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const message: AIStreamMessage = JSON.parse(event.data);

        switch (message.type) {
          case "connected":
            callbacks.onConnect?.();
            break;
          case "started":
            callbacks.onStart?.();
            break;
          case "chunk":
            if (message.content) {
              callbacks.onChunk?.(message.content);
            }
            break;
          case "complete":
            isActive = false;
            callbacks.onComplete?.();
            ws.close();
            break;
          case "error":
            isActive = false;
            callbacks.onError?.(message.content || "Unknown error");
            ws.close();
            break;
        }
      } catch (error) {
        console.error("[AI Stream] Parse error:", error);
        callbacks.onError?.("Failed to parse message");
      }
    };

    ws.onerror = (error) => {
      console.error("[AI Stream] WebSocket error:", error);
      isActive = false;
      callbacks.onError?.("WebSocket connection error");
    };

    ws.onclose = () => {
      if (isActive) {
        isActive = false;
        callbacks.onComplete?.();
      }
    };

    return {
      close: () => {
        isActive = false;
        ws.close();
      },
      isActive: () => isActive,
    };
  },
};

export type AIStream = ReturnType<typeof ai.createStream>;
