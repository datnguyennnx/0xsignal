import { describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";
import { PositiveIntegerFromQuery, TrimmedString, parseQuery } from "../param-parsers";

const sampleQuery = Schema.Struct({
  label: Schema.optionalKey(TrimmedString),
  limit: Schema.optionalKey(PositiveIntegerFromQuery),
});

const parse = (search: string) =>
  Effect.runPromise(parseQuery(new URLSearchParams(search), sampleQuery));

const parseError = (search: string) =>
  Effect.runPromise(parseQuery(new URLSearchParams(search), sampleQuery).pipe(Effect.flip));

describe("parseQuery", () => {
  it("returns the decoded values for a valid query", async () => {
    const query = await parse("label= whales &limit=25");

    expect(query).toEqual({ label: "whales", limit: 25 });
  });

  it("omits an absent optional field", async () => {
    const query = await parse("");

    expect(query).toEqual({});
  });

  it("treats a blank value as absent", async () => {
    const query = await parse("label=%20%20&limit=");

    expect(query).toEqual({});
  });

  it("rejects a value of the wrong type and names the field", async () => {
    const error = await parseError("limit=lots");

    expect(error.status).toBe(400);
    expect(error.message).toContain("limit");
    expect(error.retryable).toBe(false);
  });

  it("rejects an out-of-range value and names the field", async () => {
    const error = await parseError("limit=0");

    expect(error.status).toBe(400);
    expect(error.message).toContain("limit");
    expect(error.retryable).toBe(false);
  });
});
