import { Clock, Effect } from "effect";
import { fetchSourceText, type CalendarSourceProvider } from "../calendar-source";
import { FOREXFACTORY_FEED_URL, parse } from "./parse";

export const forexFactoryProvider: CalendarSourceProvider = {
  source: "forexfactory",
  fetchEvents: () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const body = yield* fetchSourceText("forexfactory", FOREXFACTORY_FEED_URL);
      return parse(body, { now });
    }),
};
