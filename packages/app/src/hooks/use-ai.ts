import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ai,
  type ChartContext,
  type AIStream,
  type ModelSelection,
  type TradeRecommendation,
} from "@/services/ai";

// Hook cho AI Chat Panel
export function useAI({
  symbol,
  accountValue = 10000,
  riskTolerance = "moderate",
  model,
}: {
  symbol: string;
  accountValue?: number;
  riskTolerance?: "conservative" | "moderate" | "aggressive";
  model?: ModelSelection;
}) {
  const [recommendation, setRecommendation] = useState<TradeRecommendation | null>(null);
  const [hasError, setHasError] = useState(false);
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  const tradeContext = useMemo(
    () => ({
      symbol: symbol.toUpperCase(),
      accountValue,
      riskTolerance,
    }),
    [symbol, accountValue, riskTolerance]
  );

  const mutation = useMutation({
    mutationFn: (query: string) => ai.getRecommendation(query, tradeContext, model),
    retry: 0,
    onSuccess: (data) => {
      setRecommendation(data);
      setHasError(false);
    },
    onError: () => setHasError(true),
  });

  const sendQuery = useCallback(
    (query: string) => {
      setLastQuery(query);
      setHasError(false);
      mutation.mutate(query);
    },
    [mutation]
  );

  const retry = useCallback(() => {
    if (lastQuery) {
      setHasError(false);
      mutation.reset();
      mutation.mutate(lastQuery);
    }
  }, [lastQuery, mutation]);

  return {
    recommendation,
    loading: mutation.isPending,
    error: mutation.error as Error | null,
    hasError,
    sendQuery,
    retry,
  };
}

// Hook cho AI Streaming
export function useAIStreaming({
  context,
  enabled = false,
  onComplete,
  onError,
}: {
  context: ChartContext | null;
  enabled?: boolean;
  onComplete?: (text: string) => void;
  onError?: (err: string) => void;
}) {
  const [stream, setStream] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<AIStream | null>(null);
  const fullTextRef = useRef("");
  const hasAttempted = useRef(false);

  const startStream = useCallback(() => {
    if (!context) return;

    if (streamRef.current) streamRef.current.close();

    setStream("");
    setIsStreaming(true);
    setIsConnected(false);
    setError(null);
    fullTextRef.current = "";
    hasAttempted.current = true;

    streamRef.current = ai.createStream(context, {
      onConnect: () => setIsConnected(true),
      onStart: () => setIsStreaming(true),
      onChunk: (content) => {
        fullTextRef.current += content;
        setStream((prev) => prev + content);
      },
      onComplete: () => {
        setIsStreaming(false);
        setIsConnected(false);
        onComplete?.(fullTextRef.current);
      },
      onError: (err) => {
        setIsStreaming(false);
        setIsConnected(false);
        setError(err);
        onError?.(err);
      },
    });
  }, [context, onComplete, onError]);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    setIsStreaming(false);
    setIsConnected(false);
  }, []);

  const retry = useCallback(() => {
    setError(null);
    hasAttempted.current = false;
    startStream();
  }, [startStream]);

  useEffect(() => {
    if (enabled && context && !isStreaming && !streamRef.current && !hasAttempted.current) {
      startStream();
    }
  }, [enabled, context, isStreaming, startStream]);

  useEffect(
    () => () => {
      if (streamRef.current) streamRef.current.close();
    },
    []
  );

  return { stream, isStreaming, isConnected, error, startStream, stopStream, retry };
}
