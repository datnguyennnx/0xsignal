import type { Server } from "bun";
import { Effect } from "effect";
import type { HttpError } from "./error-response";
import { errorResponse } from "./error-response";
import type { WsSetup } from "./ws";

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
 * 1. WebSocket upgrade handling (delegated to the injected `ws` setup)
 * 2. HTTP routing (delegated to the injected `handleRequest`)
 * 3. CORS and error handling
 */
export const createFetchHandler = <R, D>(
  runRequest: (effect: Effect.Effect<Response, never, R>) => Promise<Response>,
  cors: CorsConfig,
  ws: WsSetup<D>,
  mapError: (error: unknown) => HttpError,
  handleRequest: (request: Request) => Effect.Effect<Response, never, R>,
) => {
  const corsHeaders = cors.headers;
  const applyCors = cors.applyTo;
  const corsPreflight = cors.preflight;

  return async (req: Request, server: Server<D>): Promise<Response | undefined> => {
    const url = new URL(req.url);

    const wsResult = ws.upgrade(url, req, server);

    // upgrade returned a Response → WS error (validation or upgrade failure)
    if (wsResult !== undefined) {
      const headers = new Headers(wsResult.headers);
      for (const k of Object.keys(corsHeaders)) {
        headers.set(k, corsHeaders[k]);
      }
      return new Response(wsResult.body, { status: wsResult.status, headers });
    }

    // undefined + WS path → upgrade succeeded, Bun handles the rest
    if (url.pathname === ws.path) return undefined;

    if (req.method === "OPTIONS") return corsPreflight;

    try {
      const response = await runRequest(
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
      return errorResponse(mapError(error), corsHeaders);
    }
  };
};
