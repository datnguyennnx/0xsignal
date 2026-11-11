import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  MP_MAP,
  asAddress,
  asCloid,
  asDecimal,
  cast,
  encode,
  l1ActionDigest,
  map,
  obj,
  toObject,
  toWirePrice,
  toWireSize,
  type Address,
  type Cloid,
  type MpMap,
  type MpValue,
} from "../index";
import { APPROVE_AGENT, L1_ENCODERS, USD_CLASS_TRANSFER, type OrderWire } from "./actions/index";

const encodeOrder = L1_ENCODERS.order;
const encodeCancel = L1_ENCODERS.cancel;
const encodeCancelByCloid = L1_ENCODERS.cancelByCloid;
const encodeModify = L1_ENCODERS.modify;
const encodeBatchModify = L1_ENCODERS.batchModify;
const encodeScheduleCancel = L1_ENCODERS.scheduleCancel;
const encodeUpdateLeverage = L1_ENCODERS.updateLeverage;
const encodeUpdateIsolatedMargin = L1_ENCODERS.updateIsolatedMargin;
const encodeTwapOrder = L1_ENCODERS.twapOrder;
const encodeTwapCancel = L1_ENCODERS.twapCancel;
const encodeNoop = L1_ENCODERS.noop;
const encodeSetReferrer = L1_ENCODERS.setReferrer;

const BUILDER: Address = asAddress("0x2222222222222222222222222222222222222222");
const CLOID: Cloid = asCloid("0x0102030405060708090a0b0c0d0e0f10");

const keys = (m: MpMap): string[] => m.map(([key]) => key);

const valueAt = (m: MpMap, key: string): MpValue => {
  const pair = m.find(([k]) => k === key);
  if (pair === undefined) throw new Error(`missing key ${key}`);
  return pair[1];
};

const isMap = (v: unknown): v is MpMap => Array.isArray(v) && MP_MAP in v;

const child = (m: MpMap, key: string): MpMap => {
  const v = valueAt(m, key);
  if (!isMap(v)) throw new Error(`expected map at ${key}`);
  return v;
};

const element = (m: MpMap, key: string): MpMap => {
  const v = valueAt(m, key);
  if (!Array.isArray(v)) throw new Error(`expected array at ${key}`);
  const first: unknown = v[0];
  if (!isMap(first)) throw new Error(`expected map element at ${key}[0]`);
  return first;
};

const orderLimit: OrderWire = {
  a: 4,
  b: true,
  p: toWirePrice(asDecimal("1100"), 5, "perp"),
  s: toWireSize(asDecimal("0.1"), 5),
  r: false,
  t: { limit: { tif: "Gtc" } },
};

const orderTrigger: OrderWire = {
  a: 0,
  b: false,
  p: toWirePrice(asDecimal("50000"), 5, "perp"),
  s: toWireSize(asDecimal("0.01"), 5),
  r: true,
  t: {
    trigger: { isMarket: false, triggerPx: toWirePrice(asDecimal("49000"), 5, "perp"), tpsl: "sl" },
  },
};

const USD_CLASS_TRANSFER_INPUT = {
  amount: asDecimal("100"),
  toPerp: true,
  nonce: 1_700_000_000_000,
  hyperliquidChain: "Mainnet" as const,
  signatureChainId: "0xa4b1",
};

const APPROVE_AGENT_INPUT = {
  agentAddress: BUILDER,
  agentName: "agent",
  nonce: 1_700_000_000_000,
  hyperliquidChain: "Mainnet" as const,
  signatureChainId: "0xa4b1",
};

describe("documented L1 action wire order", () => {
  test("order: type first and documented key sequence", () => {
    const wire = encodeOrder({ orders: [orderLimit], grouping: "na" });
    expect(wire[0]).toEqual(["type", "order"]);
    expect(keys(wire)).toEqual(["type", "orders", "grouping"]);
    expect(keys(element(wire, "orders"))).toEqual(["a", "b", "p", "s", "r", "t"]);
    expect(keys(child(element(wire, "orders"), "t"))).toEqual(["limit"]);
    expect(keys(child(child(element(wire, "orders"), "t"), "limit"))).toEqual(["tif"]);
  });

  test("order trigger: documented trigger key sequence", () => {
    const wire = encodeOrder({ orders: [orderTrigger], grouping: "na" });
    const t = child(element(wire, "orders"), "t");
    expect(keys(t)).toEqual(["trigger"]);
    expect(keys(child(t, "trigger"))).toEqual(["isMarket", "triggerPx", "tpsl"]);
  });

  test("order: builder only appears when provided", () => {
    const without = encodeOrder({ orders: [orderLimit], grouping: "na" });
    expect(keys(without)).not.toContain("builder");
    const withBuilder = encodeOrder({
      orders: [orderLimit],
      grouping: "na",
      builder: { b: BUILDER, f: 10 },
    });
    expect(keys(withBuilder)).toEqual(["type", "orders", "grouping", "builder"]);
  });

  test("order: cloid c only appears when provided", () => {
    const without = encodeOrder({ orders: [orderLimit], grouping: "na" });
    expect(keys(element(without, "orders"))).not.toContain("c");
    const withCloid = encodeOrder({ orders: [{ ...orderLimit, c: CLOID }], grouping: "na" });
    expect(keys(element(withCloid, "orders"))).toEqual(["a", "b", "p", "s", "r", "t", "c"]);
  });

  test("cancel: documented key sequence and no f:false", () => {
    const wire = encodeCancel({ cancels: [{ a: 0, o: 123 }] });
    expect(wire[0]).toEqual(["type", "cancel"]);
    expect(keys(wire)).toEqual(["type", "cancels"]);
    expect(keys(element(wire, "cancels"))).toEqual(["a", "o"]);
    expect(keys(wire)).not.toContain("f");
    const flagged = encodeCancel({ cancels: [{ a: 0, o: 123 }], f: true });
    expect(keys(flagged)).toEqual(["type", "cancels", "f"]);
  });

  test("cancelByCloid: documented key sequence and no f:false", () => {
    const wire = encodeCancelByCloid({ cancels: [{ asset: 0, cloid: CLOID }] });
    expect(wire[0]).toEqual(["type", "cancelByCloid"]);
    expect(keys(wire)).toEqual(["type", "cancels"]);
    expect(keys(element(wire, "cancels"))).toEqual(["asset", "cloid"]);
    expect(keys(wire)).not.toContain("f");
    const flagged = encodeCancelByCloid({ cancels: [{ asset: 0, cloid: CLOID }], f: true });
    expect(keys(flagged)).toEqual(["type", "cancels", "f"]);
  });

  test("modify: documented key sequence", () => {
    const wire = encodeModify({ oid: 1, order: orderLimit });
    expect(wire[0]).toEqual(["type", "modify"]);
    expect(keys(wire)).toEqual(["type", "oid", "order"]);
    expect(keys(child(wire, "order"))).toEqual(["a", "b", "p", "s", "r", "t"]);
  });

  test("batchModify: documented key sequence", () => {
    const wire = encodeBatchModify({ modifies: [{ oid: 1, order: orderLimit }] });
    expect(wire[0]).toEqual(["type", "batchModify"]);
    expect(keys(wire)).toEqual(["type", "modifies"]);
    expect(keys(element(wire, "modifies"))).toEqual(["oid", "order"]);
  });

  test("scheduleCancel: documented key sequence", () => {
    const wire = encodeScheduleCancel({ time: 1_700_000_000_000 });
    expect(wire[0]).toEqual(["type", "scheduleCancel"]);
    expect(keys(wire)).toEqual(["type", "time"]);
  });

  test("updateLeverage: documented key sequence", () => {
    const wire = encodeUpdateLeverage({ asset: 0, isCross: true, leverage: 10 });
    expect(wire[0]).toEqual(["type", "updateLeverage"]);
    expect(keys(wire)).toEqual(["type", "asset", "isCross", "leverage"]);
  });

  test("updateIsolatedMargin: documented key sequence", () => {
    const wire = encodeUpdateIsolatedMargin({ asset: 0, isBuy: true, ntli: 100 });
    expect(wire[0]).toEqual(["type", "updateIsolatedMargin"]);
    expect(keys(wire)).toEqual(["type", "asset", "isBuy", "ntli"]);
  });

  test("twapOrder: documented key sequence", () => {
    const wire = encodeTwapOrder({
      twap: { a: 0, b: true, s: toWireSize(asDecimal("0.01"), 5), r: false, m: 10, t: true },
    });
    expect(wire[0]).toEqual(["type", "twapOrder"]);
    expect(keys(wire)).toEqual(["type", "twap"]);
    expect(keys(child(wire, "twap"))).toEqual(["a", "b", "s", "r", "m", "t"]);
  });

  test("twapCancel: documented key sequence", () => {
    const wire = encodeTwapCancel({ a: 0, t: 1 });
    expect(wire[0]).toEqual(["type", "twapCancel"]);
    expect(keys(wire)).toEqual(["type", "a", "t"]);
  });

  test("noop: documented key sequence", () => {
    const wire = encodeNoop({});
    expect(wire[0]).toEqual(["type", "noop"]);
    expect(keys(wire)).toEqual(["type"]);
  });

  test("setReferrer: documented key sequence", () => {
    const wire = encodeSetReferrer({ type: "setReferrer", code: "CODE" });
    expect(wire[0]).toEqual(["type", "setReferrer"]);
    expect(keys(wire)).toEqual(["type", "code"]);
  });

  test("usdClassTransfer: documented key sequence", () => {
    const wire = USD_CLASS_TRANSFER.encode(USD_CLASS_TRANSFER_INPUT);
    expect(wire[0]).toEqual(["type", "usdClassTransfer"]);
    expect(keys(wire)).toEqual(["type", "amount", "toPerp", "nonce"]);
  });

  test("approveAgent: documented key sequence", () => {
    const wire = APPROVE_AGENT.encode(APPROVE_AGENT_INPUT);
    expect(wire[0]).toEqual(["type", "approveAgent"]);
    expect(keys(wire)).toEqual(["type", "agentAddress", "agentName", "nonce"]);
  });

  test("order matches the documented JSON body", () => {
    const wire = encodeOrder({ orders: [orderLimit], grouping: "na" });
    expect(toObject(wire)).toEqual({
      type: "order",
      orders: [
        {
          a: 4,
          b: true,
          p: "1100",
          s: "0.1",
          r: false,
          t: { limit: { tif: "Gtc" } },
        },
      ],
      grouping: "na",
    });
  });

  test("cancel matches the documented JSON body", () => {
    const wire = encodeCancel({ cancels: [{ a: 4, o: 123 }] });
    expect(toObject(wire)).toEqual({ type: "cancel", cancels: [{ a: 4, o: 123 }] });
  });
});

type L1Vector = {
  readonly name: string;
  readonly action: Record<string, unknown>;
  readonly actionHex: string;
  readonly packedHex?: string;
  readonly nonce: string;
  readonly vault: string | null;
  readonly expiresAfter: string | null;
  readonly digest: string;
};

type L1Fixture = {
  readonly source: string;
  readonly version: string;
  readonly vectors: readonly L1Vector[];
};

const FIXTURE_URL = new URL("../../test/fixtures/l1-vectors.json", import.meta.url);

const loadFixture = (): L1Fixture =>
  cast<L1Fixture>(JSON.parse(readFileSync(FIXTURE_URL, "utf8")), "fixture");

const hexToBytes = (hex: string): Uint8Array => {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const expiresAfterOf = (vector: L1Vector): bigint | null =>
  vector.expiresAfter === null ? null : BigInt(vector.expiresAfter);

const bytesToHex = (b: Uint8Array): string =>
  `0x${Array.from(b, (v) => v.toString(16).padStart(2, "0")).join("")}`;

const toMpMap = (record: Record<string, unknown>): MpMap =>
  map(Object.keys(record).map((key) => [key, toMpValue(record[key])] as const));

const toMpValue = (value: unknown): MpValue => {
  if (Array.isArray(value)) return value.map((item) => toMpValue(item));
  if (value !== null && typeof value === "object") return toMpMap(obj(value, "action"));
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  throw new Error("unsupported fixture value");
};

const fixture = loadFixture();

describe("msgpack byte parity against the python sdk", () => {
  if (!fixture.vectors.some((vector) => vector.packedHex !== undefined)) {
    test.skip("msgpack byte parity: re-run scripts/gen-l1-vectors.py to emit packedHex", () => {});
    return;
  }
  for (const vector of fixture.vectors) {
    const { packedHex } = vector;
    if (packedHex === undefined) continue;
    test(vector.name, () => {
      expect(bytesToHex(encode(toMpMap(vector.action)))).toBe(packedHex.toLowerCase());
    });
  }
});

describe("L1 action digest against the official python sdk vectors", () => {
  if (fixture.vectors.length === 0) {
    test.skip("fixtures not generated: run scripts/gen-l1-vectors.py", () => {});
    return;
  }
  for (const vector of fixture.vectors) {
    test(vector.name, () => {
      const digest = l1ActionDigest({
        action: hexToBytes(vector.actionHex),
        nonce: BigInt(vector.nonce),
        vault: vector.vault,
        expiresAfter: expiresAfterOf(vector),
      });
      expect(bytesToHex(digest)).toBe(vector.digest.toLowerCase());
    });
  }
});
