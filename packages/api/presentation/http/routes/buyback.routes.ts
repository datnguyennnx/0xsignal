/** Buyback Routes */

import { Effect } from "effect";
import { BuybackServiceTag } from "../../../services/buyback";

const handleError = (e: { message: string }) => Effect.fail({ status: 500, message: e.message });
const notFound = (protocol: string) =>
  Effect.fail({ status: 404, message: `No buyback data for ${protocol}` });

export const buybackSignalsRoute = (limit = 50) =>
  Effect.flatMap(BuybackServiceTag, (s) => s.getBuybackSignals(limit)).pipe(
    Effect.catchTag("DataSourceError", handleError)
  );

export const buybackOverviewRoute = () =>
  Effect.flatMap(BuybackServiceTag, (s) => s.getBuybackOverview()).pipe(
    Effect.catchTag("DataSourceError", handleError)
  );

export const protocolBuybackRoute = (protocol: string) =>
  Effect.flatMap(BuybackServiceTag, (s) => s.getProtocolBuyback(protocol)).pipe(
    Effect.flatMap((signal) => (signal ? Effect.succeed(signal) : notFound(protocol))),
    Effect.catchTag("DataSourceError", handleError)
  );

export const protocolBuybackDetailRoute = (protocol: string) =>
  Effect.flatMap(BuybackServiceTag, (s) => s.getProtocolBuybackDetail(protocol)).pipe(
    Effect.flatMap((detail) => (detail ? Effect.succeed(detail) : notFound(protocol))),
    Effect.catchTag("DataSourceError", handleError)
  );
