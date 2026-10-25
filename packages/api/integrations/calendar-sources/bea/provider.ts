import { Clock, Effect } from "effect";
import { fetchSourceText, type CalendarSourceProvider } from "../calendar-source";
import { BEA_SOURCE_URL, parse } from "./parse";

export const beaProvider: CalendarSourceProvider = {
  source: "bea",
  fetchEvents: () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const body = yield* fetchSourceText("bea", BEA_SOURCE_URL);
      return parse(body, { now });
    }),
};
