import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
  WHALE_POSITIONS_LIMIT_DEFAULT,
  WHALE_POSITIONS_LIMIT_MAX,
  WHALE_POSITIONS_LIMIT_MIN,
} from "@0xsignal/shared";
import { parseWhalePositionsQuery } from "../whale.query-parsers";

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

  it("rejects an invalid side with a 400", async () => {
    const error = await parseError("side=hodl");

    expect(error.status).toBe(400);
    expect(error.message).toBe("Invalid side: hodl");
  });

  it("falls back to the default sort for an unrecognized sort token", async () => {
    const query = await parse("sort=alphabetical");

    expect(query.sort).toBe("notional");
  });

  it.each(["pnlMin", "pnlMax", "fundingMin"])(
    "rejects a non-numeric %s with a 400",
    async (key) => {
      const error = await parseError(`${key}=abc`);

      expect(error.status).toBe(400);
      expect(error.message).toBe(`Invalid ${key}: abc`);
    },
  );

  it("rejects a non-positive limit with a 400", async () => {
    const error = await parseError("limit=0");

    expect(error.status).toBe(400);
    expect(error.message).toBe("Invalid limit: 0");
  });

  it("clamps limit into the shared MIN/MAX bounds", async () => {
    expect((await parse(`limit=${WHALE_POSITIONS_LIMIT_MIN}`)).limit).toBe(
      WHALE_POSITIONS_LIMIT_MIN,
    );
    expect((await parse("limit=999")).limit).toBe(WHALE_POSITIONS_LIMIT_MAX);
  });
});
