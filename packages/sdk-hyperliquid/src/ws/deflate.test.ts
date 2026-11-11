import { describe, expect, test } from "bun:test";
import { decodeFastAssetCtxs } from "./deflate";

const VECTOR =
  "q1ZyCnFWsqpWyk0syg6oULJSsjQ3NTDQM1Wq1VFyDfFAkTI2MzXQMwJLVVRWWfmFuTiiyBuamOoZKdXWAgA=";

describe("fastAssetCtxs deflate", () => {
  test("decodes the documented compressed vector to the documented asset contexts", async () => {
    const decoded = await decodeFastAssetCtxs(VECTOR);
    expect(decoded).toEqual({
      BTC: { markPx: 97500.5 },
      ETH: { markPx: 3650.25 },
      "xyz:NVDA": { markPx: 145.2 },
    });
  });

  test("preserves the exact numeric mark prices", async () => {
    const decoded = await decodeFastAssetCtxs(VECTOR);
    expect(decoded["BTC"]?.markPx).toBe(97500.5);
    expect(decoded["ETH"]?.markPx).toBe(3650.25);
    expect(decoded["xyz:NVDA"]?.markPx).toBe(145.2);
  });
});
