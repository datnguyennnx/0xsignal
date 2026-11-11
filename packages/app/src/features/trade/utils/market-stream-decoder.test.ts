import { describe, expect, test } from "bun:test";
import type { L2BookSnapshotPayload } from "./market-stream-decoder";
import { decodeMarketWsMessage, isL2BookSnapshotPayload } from "./market-stream-decoder";

const bids = [{ px: "100", sz: "1", n: 1 }];
const asks = [{ px: "101", sz: "1", n: 1 }];

const decodeSnapshot = (data: Record<string, unknown>): L2BookSnapshotPayload | null => {
  const decoded = decodeMarketWsMessage({ channel: "l2Book", data }, "l2Book");
  if (decoded.kind !== "market") return null;
  return decoded.payload as L2BookSnapshotPayload;
};

describe("decodeMarketWsMessage l2Book snapshot metadata", () => {
  test("preserves time and degraded", () => {
    const payload = decodeSnapshot({
      levels: [bids, asks],
      time: 1794388497188,
      degraded: ["slow"],
    });

    expect(payload).not.toBeNull();
    expect(payload?.time).toBe(1794388497188);
    expect(payload?.degraded).toEqual(["slow"]);
    expect(payload && "time" in payload).toBe(true);
    expect(payload && "degraded" in payload).toBe(true);
  });

  test("preserves time and degraded from the hub snapshot wrapper", () => {
    const payload = decodeSnapshot({
      snapshot: { levels: [bids, asks], time: 1794388497188, degraded: ["fast", "slow"] },
    });

    expect(payload?.time).toBe(1794388497188);
    expect(payload?.degraded).toEqual(["fast", "slow"]);
  });

  test("omits the keys when the source has neither", () => {
    const payload = decodeSnapshot({ levels: [bids, asks] });

    expect(payload).not.toBeNull();
    expect(payload && "time" in payload).toBe(false);
    expect(payload && "degraded" in payload).toBe(false);
    expect(Object.keys(payload ?? {}).sort()).toEqual(["levels", "type"]);
  });

  test("drops a degraded list with an unknown leg", () => {
    const payload = decodeSnapshot({
      levels: [bids, asks],
      time: 1794388497188,
      degraded: ["fast", "nope"],
    });

    expect(payload?.time).toBe(1794388497188);
    expect(payload && "degraded" in payload).toBe(false);
  });

  test("drops a non-numeric time", () => {
    const payload = decodeSnapshot({ levels: [bids, asks], time: "1794" });

    expect(payload && "time" in payload).toBe(false);
  });

  test("keeps the existing snapshot decode shape", () => {
    const decoded = decodeMarketWsMessage(
      { channel: "l2Book", data: { levels: [bids, asks], nSigFigs: 5 } },
      "l2Book",
    );

    expect(decoded).toEqual({
      kind: "market",
      channel: "l2Book",
      payload: { type: "snapshot", levels: [bids, asks] },
      meta: { nSigFigs: 5 },
    });
  });

  test("isL2BookSnapshotPayload accepts the optional fields", () => {
    expect(
      isL2BookSnapshotPayload({
        type: "snapshot",
        levels: [bids, asks],
        time: 1,
        degraded: ["slow"],
      }),
    ).toBe(true);
    expect(isL2BookSnapshotPayload({ type: "snapshot", levels: [bids, asks] })).toBe(true);
  });
});
