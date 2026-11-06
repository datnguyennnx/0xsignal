import type { AggregatedMarket, WhalePosition } from "@0xsignal/shared";

/** The public Hyperliquid REST endpoint the browser reads directly. */
export const HL_INFO_URL = "https://api.hyperliquid.xyz";

export interface CapturedRequest {
  readonly url: string;
  readonly body: unknown;
  readonly authorization: string | null;
}

export type FetchHandler = (url: string, body: unknown) => Response | Promise<Response>;

export const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isHandler = (value: unknown): value is FetchHandler => typeof value === "function";

/**
 * Install a fetch stub and return the captured calls.
 *
 * A handler sees each request; a plain payload is answered verbatim with a 200.
 */
export function stubFetch(handler?: unknown): CapturedRequest[] {
  const respond: FetchHandler = isHandler(handler) ? handler : () => jsonResponse(handler ?? {});
  const calls: CapturedRequest[] = [];
  const stub = Object.assign(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      calls.push({
        url,
        body,
        authorization: new Headers(init?.headers).get("Authorization"),
      });
      return Promise.resolve(respond(url, body));
    },
    { preconnect: (_url: string | URL) => {} },
  );
  globalThis.fetch = stub;
  return calls;
}

export const market = (overrides: Partial<AggregatedMarket> = {}): AggregatedMarket => ({
  coin: "BTC",
  rawCoin: "BTC",
  displaySymbol: "BTC-USDC",
  dexPrefix: null,
  isHip3: false,
  quoteCurrency: "USDC",
  name: "BTC",
  category: "crypto",
  displayCategory: "Crypto",
  isDelisted: false,
  dex: "",
  assetId: 0,
  marketType: "perp",
  markPx: "100",
  prevDayPx: "100",
  openInterest: "0",
  funding: "0",
  dayNtlVlm: "1000000",
  maxLeverage: 10,
  szDecimals: 4,
  ...overrides,
});

export const position = (overrides: Partial<WhalePosition> = {}): WhalePosition => ({
  userAddress: "0x0000000000000000000000000000000000000001",
  coin: "ETH",
  side: "buy",
  size: 1,
  notionalUsd: 1_000,
  entryPx: "2000",
  liquidationPx: "1500",
  markPrice: "2000",
  unrealizedPnl: 0,
  unrealizedPnlPct: 0,
  entryTime: "2026-01-01T00:00:00.000Z",
  ...overrides,
});
