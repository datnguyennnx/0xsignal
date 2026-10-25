import { Layer } from "effect";
import { HyperliquidClient } from "./hyperliquid-client";
import { HyperliquidProvider } from "./types";
import { makeHyperliquidProvider } from "./provider";
import { HyperliquidRateLimiter } from "../rate-limit";

export const hyperliquidProviderLayer: Layer.Layer<
  HyperliquidProvider,
  never,
  HyperliquidClient | HyperliquidRateLimiter
> = Layer.effect(HyperliquidProvider, makeHyperliquidProvider());
