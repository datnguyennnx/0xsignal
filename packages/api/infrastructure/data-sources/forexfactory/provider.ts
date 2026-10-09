import { Effect } from "effect";
import { fetchSourceText, type CalendarSourceProvider } from "../calendar-source";
import { FOREXFACTORY_FEED_URL, parse } from "./parse";

export const forexFactoryProvider: CalendarSourceProvider = {
  source: "forexfactory",
  fetchEvents: () =>
    fetchSourceText("forexfactory", FOREXFACTORY_FEED_URL).pipe(Effect.map((body) => parse(body))),
};
