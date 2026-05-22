import { Layer } from "effect";
import { marketDataServiceLayer } from "../../application/market-data/service";
import { userDataServiceLayer } from "../../application/user-data/service";
import { exchangeServiceLayer } from "../../application/exchange/service";

export const applicationServiceLayer = Layer.mergeAll(
  marketDataServiceLayer,
  userDataServiceLayer,
  exchangeServiceLayer
);
