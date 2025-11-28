import { Effect } from "effect";
import { BuybackServiceTag } from "../../../services/buyback";

export const buybackSignalsRoute = (limit: number = 50) =>
  Effect.gen(function* () {
    const service = yield* BuybackServiceTag;
    return yield* service.getBuybackSignals(limit);
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

export const buybackOverviewRoute = () =>
  Effect.gen(function* () {
    const service = yield* BuybackServiceTag;
    return yield* service.getBuybackOverview();
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

export const protocolBuybackRoute = (protocol: string) =>
  Effect.gen(function* () {
    const service = yield* BuybackServiceTag;
    const signal = yield* service.getProtocolBuyback(protocol);

    if (!signal) {
      return yield* Effect.fail({ status: 404, message: `No buyback data for ${protocol}` });
    }

    return signal;
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );

export const protocolBuybackDetailRoute = (protocol: string) =>
  Effect.gen(function* () {
    const service = yield* BuybackServiceTag;
    const detail = yield* service.getProtocolBuybackDetail(protocol);

    if (!detail) {
      return yield* Effect.fail({ status: 404, message: `No buyback data for ${protocol}` });
    }

    return detail;
  }).pipe(
    Effect.catchTag("DataSourceError", (error) =>
      Effect.fail({ status: 500, message: error.message })
    )
  );
