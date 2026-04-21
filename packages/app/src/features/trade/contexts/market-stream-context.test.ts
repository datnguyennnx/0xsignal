import { describe, expect, it } from "vitest";
import {
  buildMarketStreamSearchParams,
  createMarketStreamWsUrl,
  resolveApiBase,
} from "./market-stream-context";

describe("market stream URL helpers", () => {
  it("keeps /api in dev mode", () => {
    expect(resolveApiBase("https://api.example.com", true)).toBe("/api");
  });

  it("appends /api for absolute API URLs", () => {
    expect(resolveApiBase("https://api.example.com", false)).toBe("https://api.example.com/api");
  });

  it("does not duplicate /api suffix", () => {
    expect(resolveApiBase("https://api.example.com/api/", false)).toBe(
      "https://api.example.com/api"
    );
  });

  it("builds proxied websocket URL from browser location", () => {
    expect(createMarketStreamWsUrl("/api", { protocol: "http:", host: "localhost:5173" })).toBe(
      "ws://localhost:5173/api/ws/market"
    );
  });

  it("builds websocket URL from absolute API URL", () => {
    expect(createMarketStreamWsUrl("https://api.example.com/api", undefined)).toBe(
      "wss://api.example.com/api/ws/market"
    );
  });

  it("includes nSigFigs and depth aliases for l2Book precision", () => {
    const params = buildMarketStreamSearchParams({
      type: "l2Book",
      coin: "ETH",
      nSigFigs: 4,
    });

    expect(params.toString()).toBe("channel=l2Book&symbol=ETH&nSigFigs=4&depth=4");
  });

  it("changes l2Book subscription query when precision changes", () => {
    const sig5 = buildMarketStreamSearchParams({ type: "l2Book", coin: "ETH", nSigFigs: 5 });
    const sig3 = buildMarketStreamSearchParams({ type: "l2Book", coin: "ETH", nSigFigs: 3 });

    expect(sig5.toString()).toBe("channel=l2Book&symbol=ETH&nSigFigs=5&depth=5");
    expect(sig3.toString()).toBe("channel=l2Book&symbol=ETH&nSigFigs=3&depth=3");
    expect(sig5.toString()).not.toBe(sig3.toString());
  });

  it("normalizes builder-perp symbol casing in search params", () => {
    const params = buildMarketStreamSearchParams({
      type: "candle",
      coin: "XYZ:clusdt",
      interval: "1m",
    });

    expect(params.toString()).toBe("channel=candle&symbol=xyz%3ACL&interval=1m");
  });
});
