import { Layer } from "effect";
import { CalendarSources } from "./calendar-source";
import { blsProvider } from "./bls/provider";
import { beaProvider } from "./bea/provider";
import { federalReserveProvider } from "./federal-reserve/provider";
import { forexFactoryProvider } from "./forexfactory/provider";
import { secEdgarProvider } from "./sec-edgar/provider";

export const CalendarSourcesLayer = Layer.succeed(CalendarSources, [
  blsProvider,
  beaProvider,
  federalReserveProvider,
  forexFactoryProvider,
  secEdgarProvider,
]);
