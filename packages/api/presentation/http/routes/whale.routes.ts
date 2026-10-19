import { Effect } from "effect";
import { WhaleService } from "../../../application/whales/contracts";
import type { HttpError } from "../error-response";
import { parseWhalePositionsQuery } from "./whale.query-parsers";

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

        return json({
          data: {
            positions: page.positions,
            nextCursor: page.nextCursor,
            fetchedAt: new Date().toISOString(),
          },
        });
      }),
  },
];
