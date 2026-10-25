import type { Effect } from "effect";
import type { HttpError } from "./error-response";

/**
 * A transport route. The handler declares the environment `R` it still needs;
 * the composition root supplies it, so this file stays module-agnostic.
 */
export interface Route<R> {
  readonly method: string;
  readonly path: string;
  readonly handler: (request: Request, url: URL) => Effect.Effect<Response, HttpError, R>;
}
