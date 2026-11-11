import { describe, expect, test } from "bun:test";
import { encode, map, toObject } from "./msgpack";
import { arr, obj } from "./parse";

const expectBytes = (actual: Uint8Array, expected: readonly number[]): void => {
  expect(Array.from(actual)).toEqual([...expected]);
};

describe("msgpack encode", () => {
  test("encodes a one-entry map as fixmap with fixstr key and value", () => {
    expectBytes(
      encode(map([["type", "noop"]])),
      [0x81, 0xa4, 0x74, 0x79, 0x70, 0x65, 0xa4, 0x6e, 0x6f, 0x6f, 0x70],
    );
  });

  test("the noop map is 11 bytes", () => {
    expect(encode(map([["type", "noop"]])).length).toBe(11);
  });

  test("encodes positive fixint 1", () => {
    expectBytes(encode(1), [0x01]);
  });

  test("encodes negative fixint -1", () => {
    expectBytes(encode(-1), [0xff]);
  });

  test("encodes true as true marker", () => {
    expectBytes(encode(true), [0xc3]);
  });

  test("encodes false as false marker", () => {
    expectBytes(encode(false), [0xc2]);
  });

  test("encodes null as nil marker", () => {
    expectBytes(encode(null), [0xc0]);
  });

  test("encodes empty string as fixstr with zero length", () => {
    expectBytes(encode(""), [0xa0]);
  });

  test("encodes 127 as positive fixint", () => {
    expectBytes(encode(127), [0x7f]);
  });

  test("encodes 128 as uint8", () => {
    expectBytes(encode(128), [0xcc, 0x80]);
  });

  test("encodes 256 as uint16 big-endian", () => {
    expectBytes(encode(256), [0xcd, 0x01, 0x00]);
  });

  test("encodes 65536 as uint32 big-endian", () => {
    expectBytes(encode(65536), [0xce, 0x00, 0x01, 0x00, 0x00]);
  });

  test("encodes -32 as negative fixint", () => {
    expectBytes(encode(-32), [0xe0]);
  });

  test("encodes -33 as int8", () => {
    expectBytes(encode(-33), [0xd0, 0xdf]);
  });

  test("encodes bigint 1n as positive fixint", () => {
    expectBytes(encode(1n), [0x01]);
  });

  test("encodes max uint64 bigint as uint64 marker plus eight 0xff bytes", () => {
    expectBytes(encode(2n ** 64n - 1n), [0xcf, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  });

  test("encodes an array of maps as fixarray not fixmap", () => {
    expectBytes(
      encode([map([["a", 1]]), map([["b", 2]])]),
      [0x92, 0x81, 0xa1, 0x61, 0x01, 0x81, 0xa1, 0x62, 0x02],
    );
  });
});

describe("msgpack toObject", () => {
  test("preserves top-level key order and converts nested maps and arrays", () => {
    const value = toObject(
      map([
        ["type", "cancel"],
        [
          "cancels",
          [
            map([
              ["a", 1],
              ["o", 2],
            ]),
          ],
        ],
      ]),
    );
    expect(Object.keys(value)).toEqual(["type", "cancels"]);
    expect(value).toEqual({ type: "cancel", cancels: [{ a: 1, o: 2 }] });
    const cancels = arr(value["cancels"], "cancels");
    const nested = obj(cancels[0], "cancels[0]");
    expect(Object.keys(nested)).toEqual(["a", "o"]);
  });
});
