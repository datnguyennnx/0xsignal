import { describe, expect, test } from "bun:test";
import { ValidationError } from "../core/errors";
import { parseSpotMetaAndAssetCtxs } from "./parse";

const spotToken = (evmContract: unknown) => ({
  name: "HYPE",
  szDecimals: 2,
  weiDecimals: 8,
  index: 1,
  tokenId: "0x1",
  isCanonical: true,
  evmContract,
  fullName: "Hyperliquid",
});

const response = (evmContract: unknown) => [{ tokens: [spotToken(evmContract)], universe: [] }, []];

describe("parseSpotMetaAndAssetCtxs evmContract", () => {
  test("preserves the descriptor object", () => {
    const descriptor = { address: "0xabc", evm_extra_wei_decimals: 8 };

    const result = parseSpotMetaAndAssetCtxs(response(descriptor));

    expect(result[0]?.tokens[0]?.evmContract).toEqual(descriptor);
  });

  test("keeps a null evmContract", () => {
    const result = parseSpotMetaAndAssetCtxs(response(null));

    expect(result[0]?.tokens[0]?.evmContract).toBeNull();
  });

  test("preserves a plain address string", () => {
    const result = parseSpotMetaAndAssetCtxs(response("0xabc"));

    expect(result[0]?.tokens[0]?.evmContract).toBe("0xabc");
  });

  test("rejects a malformed descriptor", () => {
    expect(() => parseSpotMetaAndAssetCtxs(response({ address: 1 }))).toThrow(ValidationError);
  });
});
