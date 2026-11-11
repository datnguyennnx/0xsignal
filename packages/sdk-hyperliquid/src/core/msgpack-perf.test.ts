import { describe, expect, test } from "bun:test";
import { encode, MP_MAP, map, type MpValue } from "./msgpack";

const hexOf = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += (bytes[i] ?? 0).toString(16).padStart(2, "0");
  }
  return out;
};

const orderBatch = (): MpValue[] => [
  map([
    ["a", 0],
    ["b", true],
    ["p", "100"],
  ]),
  map([
    ["a", 1],
    ["b", true],
    ["p", "100"],
  ]),
  map([
    ["a", 2],
    ["b", true],
    ["p", "100"],
  ]),
];

describe("msgpack byte parity", () => {
  test("noop map", () => {
    expect(hexOf(encode(map([["type", "noop"]])))).toBe("81a474797065a46e6f6f70");
  });

  test("three-order batch", () => {
    expect(hexOf(encode(orderBatch()))).toBe(
      "9383a16100a162c3a170a331303083a16101a162c3a170a331303083a16102a162c3a170a3313030",
    );
  });

  test("nested map holding an array of maps", () => {
    const payload = map([
      ["type", "batch"],
      ["orders", [map([["a", 1]])]],
    ]);
    expect(hexOf(encode(payload))).toBe("82a474797065a56261746368a66f72646572739181a16101");
  });

  test("numeric keys keep insertion order", () => {
    const payload = map([
      ["2", "c"],
      ["1", "b"],
      ["10", "a"],
    ]);
    expect(hexOf(encode(payload))).toBe("83a132a163a131a162a23130a161");
  });

  test("bigint uint64 boundary", () => {
    expect(hexOf(encode(2n ** 64n - 1n))).toBe(`cf${"ff".repeat(8)}`);
    expect(hexOf(encode(2n ** 32n))).toBe("cf0000000100000000");
  });
});

describe("msgpack allocation invariants", () => {
  test("map returns a fresh array with the shared frozen tag", () => {
    const first = map([["a", 1]]);
    const second = map([["a", 1]]);
    expect(first).not.toBe(second);
    expect(first[MP_MAP]).toBe(second[MP_MAP]);
    expect(Object.isFrozen(first[MP_MAP])).toBe(true);
  });

  test("encode is pure across repeated calls", () => {
    const payload = map([
      ["a", 0],
      ["b", true],
      ["p", "100"],
    ]);
    const first = encode(payload);
    const second = encode(payload);
    first[0] = 0x00;
    const third = encode(payload);
    expect(hexOf(second)).toBe(hexOf(third));
    expect(hexOf(third)).toBe("83a16100a162c3a170a3313030");
  });
});
