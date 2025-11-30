/** Global Market Routes */

import { Effect } from "effect";
import { GlobalMarketService } from "../../../infrastructure/data-sources/coingecko";

const handleError = (e: { message: string }) => Effect.fail({ status: 500, message: e.message });

export const globalMarketRoute = () =>
  Effect.flatMap(GlobalMarketService, (s) => s.getGlobalMarket()).pipe(
    Effect.catchTag("DataSourceError", handleError)
  );
