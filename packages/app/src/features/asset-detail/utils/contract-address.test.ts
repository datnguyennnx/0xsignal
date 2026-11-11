import { describe, expect, test } from "bun:test";
import { contractAddressText } from "./contract-address";

const ADDRESS = "0x1111111111111111111111111111111111111111";

describe("contractAddressText", () => {
  test("resolves the venue descriptor to its address string", () => {
    expect(contractAddressText({ address: ADDRESS, evm_extra_wei_decimals: 8 })).toBe(ADDRESS);
  });

  test("passes an already-string address through unchanged", () => {
    expect(contractAddressText(ADDRESS)).toBe(ADDRESS);
  });

  test("treats empty and absent values as absent", () => {
    expect(contractAddressText("")).toBeUndefined();
    expect(contractAddressText(null)).toBeUndefined();
    expect(contractAddressText(undefined)).toBeUndefined();
  });
});
