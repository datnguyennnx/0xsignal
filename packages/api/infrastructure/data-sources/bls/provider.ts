import { Effect } from "effect";
import { fetchSourceText, type CalendarSourceProvider } from "../calendar-source";
import { BLS_SOURCE_URL, parse } from "./parse";

export const blsProvider: CalendarSourceProvider = {
  source: "bls",
  fetchEvents: () => fetchSourceText("bls", BLS_SOURCE_URL).pipe(Effect.map((body) => parse(body))),
};
