import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Layer } from "effect";
import { appendResearchNoteTool, startBacktestRunTool, getRunSummaryTool } from "../tools";
import { BacktestServices } from "../../../application/backtest";
import { ResearchServicesTag } from "../../../application/research";

describe("MCP research/backtest tool behavior", () => {
  const mockResearchServices = {
    appendResearchNote: vi.fn(),
    createArtifact: vi.fn(),
  };

  const mockBacktestServices = {
    createBacktestRun: vi.fn(),
    saveRunInput: vi.fn(),
    getRunSummary: vi.fn(),
    appendRunEvent: vi.fn(),
    recordMetric: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestResearch = Layer.succeed(ResearchServicesTag, mockResearchServices as never);
  const TestBacktest = Layer.succeed(BacktestServices, mockBacktestServices as never);

  it("append_research_note forwards tags array unchanged", async () => {
    mockResearchServices.appendResearchNote.mockReturnValue(
      Effect.succeed({ id: "note-1", title: "N1" })
    );

    await Effect.runPromise(
      appendResearchNoteTool
        .execute({
          title: "N1",
          content_markdown: "Hello",
          session_id: "session-1",
          tags: ["alpha", "btc"],
        })
        .pipe(Effect.provide(TestResearch))
    );

    expect(mockResearchServices.appendResearchNote).toHaveBeenCalledWith(
      expect.objectContaining({ tags: ["alpha", "btc"] })
    );
  });

  it("append_research_note omits tags when undefined", async () => {
    mockResearchServices.appendResearchNote.mockReturnValue(
      Effect.succeed({ id: "note-2", title: "N2" })
    );

    await Effect.runPromise(
      appendResearchNoteTool
        .execute({
          title: "N2",
          session_id: "session-2",
        })
        .pipe(Effect.provide(TestResearch))
    );

    expect(mockResearchServices.appendResearchNote).toHaveBeenCalledWith(
      expect.objectContaining({ tags: undefined })
    );
  });

  it("append_research_note requires at least one anchor", async () => {
    await expect(
      Effect.runPromise(
        appendResearchNoteTool
          .execute({
            title: "No anchor",
          })
          .pipe(Effect.provide(TestResearch))
      )
    ).rejects.toThrow(/requires at least one anchor/);

    expect(mockResearchServices.appendResearchNote).not.toHaveBeenCalled();
  });

  it("append_research_note preserves explicit empty tags", async () => {
    mockResearchServices.appendResearchNote.mockReturnValue(
      Effect.succeed({ id: "note-3", title: "N3" })
    );

    await Effect.runPromise(
      appendResearchNoteTool
        .execute({
          title: "N3",
          session_id: "session-3",
          tags: [],
        })
        .pipe(Effect.provide(TestResearch))
    );

    expect(mockResearchServices.appendResearchNote).toHaveBeenCalledWith(
      expect.objectContaining({ tags: [] })
    );
  });

  it("start_backtest_run requires strategy_version_id and dataset_snapshot_id", async () => {
    mockBacktestServices.createBacktestRun.mockReturnValue(
      Effect.succeed({ id: "run-1", status: "pending" })
    );

    await Effect.runPromise(
      startBacktestRunTool
        .execute({ strategy_version_id: "sv-1", dataset_snapshot_id: "ds-1" })
        .pipe(Effect.provide(TestBacktest))
    );

    expect(mockBacktestServices.createBacktestRun).toHaveBeenCalledWith(
      expect.objectContaining({ strategy_version_id: "sv-1", dataset_snapshot_id: "ds-1" })
    );
  });

  it("get_run_summary maps service output shape", async () => {
    mockBacktestServices.getRunSummary.mockReturnValue(
      Effect.succeed({
        run: { id: "run-22", status: "running" },
        metrics: [{ metric_key: "total_return", metric_value: 0.1, metric_group: "performance" }],
        eventCount: 3,
      })
    );

    const result = await Effect.runPromise(
      getRunSummaryTool.execute({ run_id: "run-22" }).pipe(Effect.provide(TestBacktest))
    );

    expect(result).toEqual({
      run_id: "run-22",
      status: "running",
      metrics: [{ key: "total_return", value: 0.1, group: "performance" }],
      event_count: 3,
    });
  });

  it("create_artifact requires at least one anchor", async () => {
    const { createArtifactTool } = await import("../tools");

    await expect(
      Effect.runPromise(
        createArtifactTool
          .execute({
            artifact_type: "report",
            storage_path: "/tmp/report.md",
          })
          .pipe(Effect.provide(TestResearch))
      )
    ).rejects.toThrow(/requires at least one anchor/);

    expect(mockResearchServices.createArtifact).not.toHaveBeenCalled();
  });
});
