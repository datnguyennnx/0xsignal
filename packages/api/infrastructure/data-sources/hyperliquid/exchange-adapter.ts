import { ValidationError, HttpRequestError, TransportError } from "@nktkas/hyperliquid";
import { ApiRequestError } from "@nktkas/hyperliquid/api/exchange";
import { ValiError } from "valibot";
import {
  HyperliquidInternalError,
  HyperliquidValidationError,
  InsufficientMarginError,
} from "../../../domain/errors";

/** Maps generic TIF to Hyperliquid SDK format ("GTC" → "Gtc"). */
export const toHlTif = (tif: string): "Gtc" | "Ioc" | "Alo" | "FrontendMarket" => {
  const map: Record<string, "Gtc" | "Ioc" | "Alo" | "FrontendMarket"> = {
    GTC: "Gtc",
    IOC: "Ioc",
    FOK: "Gtc",
    Alo: "Alo",
    FrontendMarket: "FrontendMarket",
  };
  return map[tif] ?? "Gtc";
};

/** Classify a caught error from an SDK call into a typed DomainError. */
export const classifyExchangeError = (
  e: unknown
): HyperliquidValidationError | InsufficientMarginError | HyperliquidInternalError => {
  if (e instanceof ValiError) {
    return new HyperliquidValidationError({ message: e.message, cause: e });
  }
  if (e instanceof ValidationError) {
    return new HyperliquidValidationError({ message: e.message, cause: e.cause });
  }
  if (e instanceof ApiRequestError) {
    const msg = e.message.toLowerCase();
    if (msg.includes("insufficient margin")) {
      return new InsufficientMarginError({ message: e.message });
    }
    if (msg.includes("invalid") || msg.includes("size") || msg.includes("tick")) {
      return new HyperliquidValidationError({ message: e.message, cause: e });
    }
    return new HyperliquidInternalError({ message: e.message, cause: e });
  }
  if (e instanceof HttpRequestError || e instanceof TransportError) {
    return new HyperliquidInternalError({ message: e.message, cause: e });
  }
  const fallbackMsg = e instanceof Error ? e.message : String(e);
  return new HyperliquidInternalError({
    message: fallbackMsg,
    cause: e instanceof Error ? e : undefined,
  });
};
