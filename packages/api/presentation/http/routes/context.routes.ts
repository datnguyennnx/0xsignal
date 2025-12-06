/** Context Routes - Unified asset context endpoint */

import { Effect, pipe } from "effect";
import { ContextServiceTag } from "../../../services/context";
import type { ContextOptions } from "@0xsignal/shared";

const handleError = (e: Error) => Effect.fail({ status: 500, message: e.message });

export const assetContextRoute = (symbol: string, options: ContextOptions = {}) =>
  pipe(
    ContextServiceTag,
    Effect.flatMap((service) => service.getAssetContext(symbol, options)),
    Effect.catchAll(handleError)
  );
