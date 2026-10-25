import { Clock, Effect } from "effect";
import { fetchSourceText, type CalendarSourceProvider } from "../calendar-source";
import { BLS_SOURCE_URL, parse } from "./parse";

export const blsProvider: CalendarSourceProvider = {
  source: "bls",
  fetchEvents: () =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const body = yield* fetchSourceText("bls", BLS_SOURCE_URL);
      return parse(body, { now });
    }),
};
