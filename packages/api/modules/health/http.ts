import { Effect } from "effect";
import { asHttpError, type HttpError } from "../../platform/http/error-response";
import type { HealthService } from "./index";

type HealthHttpService = {
  readonly check: (typeof HealthService.Service)["check"];
};

type RouteHandler = (
  request: Request,
  url: URL,
  health: HealthHttpService,
) => Effect.Effect<Response, HttpError>;

type BuildHealthRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
};

export const buildHealthRoutes = ({
  json,
}: BuildHealthRoutesParams): Array<{
  method: string;
  path: string;
  handler: RouteHandler;
}> => [
  {
    method: "GET",
    path: "/api/health",
    handler: (_request, _url, health) =>
      Effect.gen(function* () {
        const body = yield* health
          .check()
          .pipe(Effect.mapError((error) => asHttpError(error.status, error.message)));
        return json({ data: body });
      }),
  },
];
