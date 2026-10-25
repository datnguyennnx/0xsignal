import { Clock, Effect } from "effect";
import { WhaleService } from "./index";
import type { HttpError } from "../../platform/http/error-response";
import { parseWhalePositionsQuery } from "./query";

type WhaleHttpService = {
  readonly queryPositions: (typeof WhaleService.Service)["queryPositions"];
};

type RouteHandler = (
  request: Request,
  url: URL,
  whale: WhaleHttpService,
) => Effect.Effect<Response, HttpError>;

type BuildWhaleRoutesParams = {
  readonly json: (body: unknown, status?: number, headers?: Record<string, string>) => Response;
  readonly mapServiceError: (error: unknown) => HttpError;
};

export const buildWhaleRoutes = ({
  json,
  mapServiceError,
}: BuildWhaleRoutesParams): Array<{
  method: string;
  path: string;
  handler: RouteHandler;
}> => [
  {
    method: "GET",
    path: "/api/whales/positions",
    handler: (_request, url, whale) =>
      Effect.gen(function* () {
        const query = yield* parseWhalePositionsQuery(url.searchParams);
        const page = yield* whale.queryPositions(query).pipe(Effect.mapError(mapServiceError));

        const fetchedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
        return json({
          data: {
            positions: page.positions,
            nextCursor: page.nextCursor,
            fetchedAt,
          },
        });
      }),
  },
];
