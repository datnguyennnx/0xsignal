import type { Server } from "bun";
import { Effect } from "effect";
import type { ManagedRuntime } from "effect/ManagedRuntime";
import type { MarketStreamHubPort } from "../../infrastructure/streams/hyperliquid/hub";
import { handleRequest } from "./router";
import { errorResponse } from "./error-response";
import { handleWsUpgrade } from "./ws/upgrade-handler";

/**
 * Shape of the CORS config object (resolved from CorsService in DI).
 */
interface CorsConfig {
  readonly headers: Record<string, string>;
  readonly preflight: Response;
  readonly applyTo: (headers: Headers) => Headers;
}

/**
 * Creates the Bun `fetch` callback for the HTTP server, composing:
 * 1. WebSocket upgrade handling (delegated to `handleWsUpgrade`)
 * 2. HTTP routing (delegated to `handleRequest`)
 * 3. CORS and error handling
 *
 * @param runtime  ManagedRuntime (instantiated once at server entry)
 * @param cors     Resolved CORS configuration
 * @param marketStreamHub  Resolved MarketStreamHub for WS upgrades
 */
export const createFetchHandler = (
  runtime: ManagedRuntime<unknown, unknown>,
  cors: CorsConfig,
  marketStreamHub: MarketStreamHubPort,
) => {
  const corsHeaders = cors.headers;
  const applyCors = cors.applyTo;
  const corsPreflight = cors.preflight;

  return async (req: Request, server: Server<unknown>): Promise<Response | undefined> => {
    const url = new URL(req.url);

    const wsResult = handleWsUpgrade(url, req, server, marketStreamHub);

    // handleWsUpgrade returned a Response → WS error (validation or upgrade failure)
    if (wsResult !== undefined) {
      const headers = new Headers(wsResult.headers);
      for (const k of Object.keys(corsHeaders)) {
        headers.set(k, corsHeaders[k]);
      }
      return new Response(wsResult.body, { status: wsResult.status, headers });
    }

    // undefined + WS path → upgrade succeeded, Bun handles the rest
    if (url.pathname === "/api/ws/market") return undefined;

    if (req.method === "OPTIONS") return corsPreflight;

    try {
      const response = await runtime.runPromise(
        Effect.gen(function* () {
          yield* Effect.logInfo(`${req.method} ${url.pathname}`);
          return yield* handleRequest(req);
        }),
      );

      const headers = applyCors(new Headers(response.headers));
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      // Edge of the World — Bun fetch callback outside Effect context
      console.error("[Request Error]:", error);
      return errorResponse(error, corsHeaders);
    }
  };
};
