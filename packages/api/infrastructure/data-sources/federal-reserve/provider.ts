import { Effect } from "effect";
import { fetchSourceText, type CalendarSourceProvider } from "../calendar-source";
import { FED_SOURCE_URL, parse } from "./parse";

export const federalReserveProvider: CalendarSourceProvider = {
  source: "federal-reserve",
  fetchEvents: () =>
    fetchSourceText("federal-reserve", FED_SOURCE_URL).pipe(Effect.map((body) => parse(body))),
};
