/**
 * @hyperliquid-api POST /exchange (L1 action digest)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/signing
 */

import { ValidationError } from "./errors";

export type MpValue =
  | null
  | boolean
  | string
  | number
  | bigint
  | Uint8Array
  | readonly MpValue[]
  | MpMap;

export const MP_MAP = Symbol.for("hl.msgpack.map");

const MAP_TAG_VALUE = Object.freeze({ kind: "map" as const });
const MAP_TAG = Object.freeze({ [MP_MAP]: MAP_TAG_VALUE });

export type MpMap = readonly (readonly [string, MpValue])[] & {
  readonly [MP_MAP]?: typeof MAP_TAG_VALUE;
};

const isMap = (value: readonly MpValue[] | MpMap): value is MpMap => MP_MAP in value;

export const map = (pairs: readonly (readonly [string, MpValue])[]): MpMap =>
  Object.assign(pairs, MAP_TAG);

const MAX_DEPTH = 64;
const utf8 = new TextEncoder();

class Writer {
  private buf = new Uint8Array(64);
  private len = 0;

  byte(value: number): void {
    if (this.len >= this.buf.length) this.grow(1);
    this.buf[this.len] = value;
    this.len += 1;
  }

  uint(value: number, n: number): void {
    if (this.len + n > this.buf.length) this.grow(n);
    for (let i = n - 1; i >= 0; i -= 1) {
      this.buf[this.len] = (value >>> (i * 8)) & 0xff;
      this.len += 1;
    }
  }

  bytes(value: Uint8Array): void {
    if (this.len + value.length > this.buf.length) this.grow(value.length);
    this.buf.set(value, this.len);
    this.len += value.length;
  }

  string(value: string): void {
    const capacity = value.length * 3;
    if (this.len + capacity + 5 > this.buf.length) this.grow(capacity + 5);
    const base = this.len;
    const written = utf8.encodeInto(value, this.buf.subarray(base, base + capacity)).written;
    const header = written <= 31 ? 1 : written <= 0xff ? 2 : written <= 0xffff ? 3 : 5;
    this.buf.copyWithin(base + header, base, base + written);
    this.buf[base] =
      header === 1 ? 0xa0 | written : header === 2 ? 0xd9 : header === 3 ? 0xda : 0xdb;
    if (header === 5) {
      this.buf[base + 1] = (written >>> 24) & 0xff;
      this.buf[base + 2] = (written >>> 16) & 0xff;
      this.buf[base + 3] = (written >>> 8) & 0xff;
      this.buf[base + 4] = written & 0xff;
    } else if (header === 3) {
      this.buf[base + 1] = (written >>> 8) & 0xff;
      this.buf[base + 2] = written & 0xff;
    } else if (header === 2) {
      this.buf[base + 1] = written & 0xff;
    }
    this.len = base + header + written;
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.len);
  }

  private grow(n: number): void {
    let size = this.buf.length * 2;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }
}

const float64 = (value: number): Uint8Array => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setFloat64(0, value);
  return out;
};

const int64 = (value: bigint): Uint8Array => {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt.asUintN(64, value));
  return out;
};

function writeString(w: Writer, s: string): void {
  w.string(s);
}

function writeBinary(w: Writer, b: Uint8Array): void {
  if (b.length <= 0xff) {
    w.byte(0xc4);
    w.uint(b.length, 1);
  } else if (b.length <= 0xffff) {
    w.byte(0xc5);
    w.uint(b.length, 2);
  } else {
    w.byte(0xc6);
    w.uint(b.length, 4);
  }
  w.bytes(b);
}

function writeNumber(w: Writer, value: number): void {
  if (!Number.isFinite(value)) throw new ValidationError("msgpack value", "finite number");
  if (!Number.isInteger(value)) {
    w.byte(0xcb);
    w.bytes(float64(value));
    return;
  }
  if (value >= 0) {
    if (value <= 0x7f) {
      w.byte(value);
      return;
    }
    if (value <= 0xff) {
      w.byte(0xcc);
      w.uint(value, 1);
      return;
    }
    if (value <= 0xffff) {
      w.byte(0xcd);
      w.uint(value, 2);
      return;
    }
    if (value <= 0xffffffff) {
      w.byte(0xce);
      w.uint(value, 4);
      return;
    }
    w.byte(0xcf);
    w.bytes(int64(BigInt(value)));
    return;
  }
  if (value >= -0x20) {
    w.byte(0xe0 + (value + 0x20));
    return;
  }
  if (value >= -0x80) {
    w.byte(0xd0);
    w.uint(value & 0xff, 1);
    return;
  }
  if (value >= -0x8000) {
    w.byte(0xd1);
    w.uint(value & 0xffff, 2);
    return;
  }
  if (value >= -0x80000000) {
    w.byte(0xd2);
    w.uint(value >>> 0, 4);
    return;
  }
  w.byte(0xd3);
  w.bytes(int64(BigInt(value)));
}

function writeBigint(w: Writer, value: bigint): void {
  if (value < 0n) {
    if (value >= -0x80n) {
      w.byte(0xd0);
      w.uint(Number(value & 0xffn), 1);
      return;
    }
    if (value >= -0x8000n) {
      w.byte(0xd1);
      w.uint(Number(value & 0xffffn), 2);
      return;
    }
    if (value >= -0x80000000n) {
      w.byte(0xd2);
      w.uint(Number(value & 0xffffffffn), 4);
      return;
    }
    w.byte(0xd3);
    w.bytes(int64(value));
    return;
  }
  if (value <= 0x7fn) {
    w.byte(Number(value));
    return;
  }
  if (value <= 0xffn) {
    w.byte(0xcc);
    w.uint(Number(value), 1);
    return;
  }
  if (value <= 0xffffn) {
    w.byte(0xcd);
    w.uint(Number(value), 2);
    return;
  }
  if (value <= 0xffffffffn) {
    w.byte(0xce);
    w.uint(Number(value), 4);
    return;
  }
  w.byte(0xcf);
  w.bytes(int64(value));
}

function writeArray(w: Writer, items: readonly MpValue[], depth: number): void {
  if (items.length <= 15) w.byte(0x90 | items.length);
  else if (items.length <= 0xffff) {
    w.byte(0xdc);
    w.uint(items.length, 2);
  } else {
    w.byte(0xdd);
    w.uint(items.length, 4);
  }
  for (let i = 0; i < items.length; i += 1) encodeValue(w, items[i], depth + 1);
}

function writeMap(w: Writer, entries: MpMap, depth: number): void {
  if (entries.length <= 15) w.byte(0x80 | entries.length);
  else if (entries.length <= 0xffff) {
    w.byte(0xde);
    w.uint(entries.length, 2);
  } else {
    w.byte(0xdf);
    w.uint(entries.length, 4);
  }
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry === undefined) continue;
    writeString(w, entry[0]);
    encodeValue(w, entry[1], depth + 1);
  }
}

function encodeValue(w: Writer, value: MpValue | undefined, depth: number): void {
  if (depth > MAX_DEPTH) {
    throw new ValidationError("msgpack value", `nesting depth <= ${MAX_DEPTH}`);
  }
  if (value === undefined) throw new ValidationError("msgpack value", "defined");
  if (value === null) {
    w.byte(0xc0);
    return;
  }
  if (typeof value === "boolean") {
    w.byte(value ? 0xc3 : 0xc2);
    return;
  }
  if (typeof value === "string") {
    writeString(w, value);
    return;
  }
  if (typeof value === "number") {
    writeNumber(w, value);
    return;
  }
  if (typeof value === "bigint") {
    writeBigint(w, value);
    return;
  }
  if (value instanceof Uint8Array) {
    writeBinary(w, value);
    return;
  }
  if (isMap(value)) {
    writeMap(w, value, depth);
    return;
  }
  writeArray(w, value, depth);
}

export function encode(payload: MpValue): Uint8Array {
  const w = new Writer();
  encodeValue(w, payload, 0);
  return w.finish();
}

export function toBytesMap(pairs: MpMap): Uint8Array {
  return encode(pairs);
}

function plainValue(value: MpValue): unknown {
  if (value === null || typeof value !== "object") {
    return typeof value === "bigint" ? Number(value) : value;
  }
  if (value instanceof Uint8Array) return value;
  if (isMap(value)) return toObject(value);
  return value.map((item) => plainValue(item));
}

export function toObject(m: MpMap): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of m) out[key] = plainValue(value);
  return out;
}
