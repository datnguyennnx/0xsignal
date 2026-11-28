/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import {
  buildAlertStreamUrl,
  createNoticeLedger,
  decodeAlertFrame,
  type AlertNotice,
} from "./use-alert-stream";

const notice = (overrides: Partial<AlertNotice> = {}): AlertNotice => ({
  ruleName: "BTC above 100000",
  severity: "info",
  summary: "BTC above 100000",
  firedAt: 1_700_000_000_000,
  payload: {},
  ...overrides,
});

describe("decodeAlertFrame", () => {
  test("reads the hello frame", () => {
    expect(decodeAlertFrame(JSON.stringify({ type: "hello", subject: "user" }))).toEqual({
      kind: "hello",
      subject: "user",
    });
  });

  test("reads a notice frame", () => {
    const frame = decodeAlertFrame(
      JSON.stringify({
        type: "notice",
        notice: {
          ruleName: "ETH below 2000",
          severity: "critical",
          summary: "ETH below 2000",
          firedAt: 1_700_000_000_000,
          payload: { price: 1999 },
        },
      }),
    );

    expect(frame).toEqual({
      kind: "notice",
      notice: {
        ruleName: "ETH below 2000",
        severity: "critical",
        summary: "ETH below 2000",
        firedAt: 1_700_000_000_000,
        payload: { price: 1999 },
      },
    });
  });

  test("ignores unreadable and incomplete frames", () => {
    expect(decodeAlertFrame("not json")).toEqual({ kind: "other" });
    expect(decodeAlertFrame(new ArrayBuffer(2))).toEqual({ kind: "other" });
    expect(decodeAlertFrame(JSON.stringify({ type: "notice", notice: { summary: "x" } }))).toEqual({
      kind: "other",
    });
    expect(decodeAlertFrame(JSON.stringify({ type: "ping" }))).toEqual({ kind: "other" });
  });
});

describe("createNoticeLedger", () => {
  test("forwards each rule and fire time once", () => {
    const ledger = createNoticeLedger();

    expect(ledger.accept(notice())).toBe(true);
    expect(ledger.accept(notice())).toBe(false);
    expect(ledger.accept(notice({ ruleName: "ETH below 2000" }))).toBe(true);
    expect(ledger.accept(notice({ firedAt: 1_700_000_000_001 }))).toBe(true);
  });

  test("evicts the oldest pair past the bound", () => {
    const ledger = createNoticeLedger(2);

    expect(ledger.accept(notice({ firedAt: 1 }))).toBe(true);
    expect(ledger.accept(notice({ firedAt: 2 }))).toBe(true);
    expect(ledger.accept(notice({ firedAt: 3 }))).toBe(true);
    expect(ledger.accept(notice({ firedAt: 1 }))).toBe(true);
    expect(ledger.accept(notice({ firedAt: 3 }))).toBe(false);
  });
});

describe("buildAlertStreamUrl", () => {
  test("routes a relative API base through the page origin", () => {
    expect(buildAlertStreamUrl("/api", { protocol: "https:", host: "app.test" })).toBe(
      "wss://app.test/api/ws/alerts",
    );
  });

  test("upgrades an absolute API base to a socket origin", () => {
    expect(buildAlertStreamUrl("https://api.test/api", undefined)).toBe(
      "wss://api.test/api/ws/alerts",
    );
  });
});
