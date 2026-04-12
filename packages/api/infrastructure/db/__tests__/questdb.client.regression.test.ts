import { describe, it, expect, vi, beforeEach } from "vitest";
import { Effect } from "effect";
import { query, ingest, QuestDBClient } from "../questdb/client";

describe("QuestDB Client Regression - JSON vs ILP", () => {
  const config = { httpUrl: "http://localhost:9000" };

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("query: should fail with descriptive error if response is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("timestamp=2024-01-01 i_am_not_json"),
      status: 200,
    } as any);

    const program = query("SELECT * FROM candle").pipe(
      Effect.provideService(QuestDBClient, config)
    );

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      // For a TaggedError, it is usually wrapped in a Fail cause
      // We can use JSON.stringify as a fallback if the object structure is obscure
      const errorStr = JSON.stringify(result);
      expect(errorStr).toContain("QuestDBError");
      expect(errorStr).toContain("Failed to execute query");
      expect(errorStr).toContain("Failed to parse QuestDB JSON response");
      expect(errorStr).toContain("timestamp=2024-01-01");
    }
  });

  it("ingest: should NOT attempt to parse JSON for ILP success", async () => {
    // QuestDB /write returns 204 No Content usually
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 204,
      text: () => Promise.resolve(""),
    } as any);

    const program = ingest(["candle,s=BTC v=1 1000"]).pipe(
      Effect.provideService(QuestDBClient, config)
    );

    const result = await Effect.runPromiseExit(program);
    expect(result._tag).toBe("Success");
  });

  it("query: should succeed if response is valid JSON", async () => {
    const mockResponse = {
      query: "SELECT",
      columns: [{ name: "cnt", type: "long" }],
      dataset: [[100]],
      count: 1,
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(mockResponse)),
      status: 200,
    } as any);

    const program = query("SELECT count(*) FROM candle").pipe(
      Effect.provideService(QuestDBClient, config)
    );

    const result = await Effect.runPromise(program);
    expect(result.count).toBe(1);
    expect(result.dataset[0][0]).toBe(100);
  });
});
