import { Config, Context, Effect, Layer } from "effect";

export class CorsService extends Context.Service<
  CorsService,
  {
    readonly headers: Record<string, string>;
    readonly preflight: Response;
    readonly applyTo: (headers: Headers) => Headers;
  }
>()("CorsService") {}

export const CorsServiceLayer = Layer.effect(
  CorsService,
  Effect.gen(function* () {
    const frontendUrl = yield* Config.string("FRONTEND_URL").pipe(
      Config.withDefault("http://localhost:5173")
    );

    const headers = {
      "Access-Control-Allow-Origin": frontendUrl,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      Vary: "Origin",
    } as const;

    const preflight = new Response(null, {
      status: 204,
      headers,
    });

    return CorsService.of({
      headers,
      preflight,
      applyTo: (responseHeaders: Headers): Headers => {
        for (const [key, value] of Object.entries(headers)) {
          responseHeaders.set(key, value);
        }
        return responseHeaders;
      },
    });
  })
);
