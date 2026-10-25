import { Clock, Effect } from "effect";
import { fetchSourceText, type CalendarSourceProvider } from "../calendar-source";
import { FED_SOURCE_URL, parse } from "./parse";

export const federalReserveProvider: CalendarSourceProvider = {
  source: "federal-reserve",
  fetchEvents: () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const body = yield* fetchSourceText("federal-reserve", FED_SOURCE_URL);
      return parse(body, { now });
    }),
};
