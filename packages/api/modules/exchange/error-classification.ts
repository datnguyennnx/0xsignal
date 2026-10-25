import { Effect } from "effect";
import { HyperliquidValidationError } from "../../shared/errors";

export type HlTif = "Gtc" | "Ioc" | "Alo" | "FrontendMarket";

// Hyperliquid's order schema accepts only these four TIF values; FOK has no
// equivalent, and mapping it to Gtc would turn a kill-or-nothing order into a
// resting order, so it must fail loudly instead.
const hlTifByOrderType: Record<string, HlTif> = {
  GTC: "Gtc",
  IOC: "Ioc",
  ALO: "Alo",
  Alo: "Alo",
  PostOnly: "Alo",
  FrontendMarket: "FrontendMarket",
  Market: "FrontendMarket",
};

export const toHlTif = (tif: string): Effect.Effect<HlTif, HyperliquidValidationError> => {
  const mapped = hlTifByOrderType[tif];
  if (mapped !== undefined) return Effect.succeed(mapped);
  const message =
    tif === "FOK"
      ? "FOK is not supported by Hyperliquid: there is no fill-or-kill time-in-force, so reject instead of downgrading to a resting Gtc order"
      : `Unsupported timeInForce: ${tif}`;
  return Effect.fail(new HyperliquidValidationError({ message, input: tif }));
};
