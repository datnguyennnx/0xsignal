import { Layer } from "effect";
import { ExchangeService } from "./index";
import { makeExchangeService } from "./service";

export const exchangeServiceLayer = Layer.effect(ExchangeService, makeExchangeService());
