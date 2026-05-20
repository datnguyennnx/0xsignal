import { Layer } from "effect";
import { MarketDataServicesLive } from "../../application/market-data/service";
import { UserDataServicesLive } from "../../application/user-data/service";
import { ExchangeServicesLive } from "../../application/exchange/service";

export const AppServicesLive = Layer.mergeAll(
  MarketDataServicesLive,
  UserDataServicesLive,
  ExchangeServicesLive
);
