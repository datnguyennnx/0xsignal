import type { Effect } from "effect";
import type { HttpError } from "./error-response";

/**
 * A transport route. The handler declares the environment `R` it still needs;
 * the composition root supplies it, so this file stays module-agnostic.
 * `E` defaults to the declared failure type; the router accepts `Route<R, unknown>`
 * because a handler can fail with a value the type system never saw.
 */
export interface Route<R, E = HttpError> {
  readonly method: string;
  readonly path: string;
  readonly handler: (request: Request, url: URL) => Effect.Effect<Response, E, R>;
}
