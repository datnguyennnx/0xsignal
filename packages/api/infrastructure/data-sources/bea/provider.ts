import { Effect } from "effect";
import { fetchSourceText, type CalendarSourceProvider } from "../calendar-source";
import { BEA_SOURCE_URL, parse } from "./parse";

export const beaProvider: CalendarSourceProvider = {
  source: "bea",
  fetchEvents: () => fetchSourceText("bea", BEA_SOURCE_URL).pipe(Effect.map((body) => parse(body))),
};
