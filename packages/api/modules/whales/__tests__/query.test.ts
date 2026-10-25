import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
  WHALE_POSITIONS_LIMIT_DEFAULT,
  WHALE_POSITIONS_LIMIT_MAX,
  WHALE_POSITIONS_LIMIT_MIN,
} from "@0xsignal/shared";
import { parseWhalePositionsQuery } from "../query";

const parse = (search: string) =>
  Effect.runPromise(parseWhalePositionsQuery(new URLSearchParams(search)));

const parseError = (search: string) =>
  Effect.runPromise(parseWhalePositionsQuery(new URLSearchParams(search)).pipe(Effect.flip));

describe("parseWhalePositionsQuery", () => {
  it("parses every valid parameter", async () => {
    const query = await parse(
      "symbol=btc&side=buy&sort=pnl&pnlMin=100&pnlMax=500.5&fundingMin=-0.01&limit=25&cursor=abc",
    );

    expect(query).toEqual({
      symbol: "btc",
      side: "buy",
      sort: "pnl",
      pnlMin: 100,
      pnlMax: 500.5,
      fundingMin: -0.01,
      limit: 25,
      cursor: "abc",
    });
  });

  it("defaults sort and limit when no params are provided", async () => {
    const query = await parse("");

    expect(query).toEqual({
      sort: "notional",
      limit: WHALE_POSITIONS_LIMIT_DEFAULT,
    });
  });

  it("rejects an invalid side with a 400 naming the field", async () => {
    const error = await parseError("side=hodl");

    expect(error.status).toBe(400);
    expect(error.message).toContain("side");
    expect(error.retryable).toBe(false);
  });

  it("rejects an unrecognized sort token with a 400 naming the field", async () => {
    const error = await parseError("sort=alphabetical");

    expect(error.status).toBe(400);
    expect(error.message).toContain("sort");
    expect(error.retryable).toBe(false);
  });

  it.each(["pnlMin", "pnlMax", "fundingMin"])(
    "rejects a non-numeric %s with a 400 naming the field",
    async (key) => {
      const error = await parseError(`${key}=abc`);

      expect(error.status).toBe(400);
      expect(error.message).toContain(key);
      expect(error.retryable).toBe(false);
    },
  );

  it("rejects a non-positive limit with a 400 naming the field", async () => {
    const error = await parseError("limit=0");

    expect(error.status).toBe(400);
    expect(error.message).toContain("limit");
    expect(error.retryable).toBe(false);
  });

  it("trims enum filters before validating them", async () => {
    const query = await parse("side=buy%20&sort=pnl%20");

    expect(query).toMatchObject({ side: "buy", sort: "pnl" });
  });

  it("clamps limit into the shared MIN/MAX bounds", async () => {
    expect((await parse(`limit=${WHALE_POSITIONS_LIMIT_MIN}`)).limit).toBe(
      WHALE_POSITIONS_LIMIT_MIN,
    );
    expect((await parse("limit=999")).limit).toBe(WHALE_POSITIONS_LIMIT_MAX);
  });
});
