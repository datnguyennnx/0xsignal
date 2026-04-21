import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import type { ResearchRepository } from "../../ports/research-repository";
import { makeResearchService } from "../service";

describe("research service", () => {
  it("appendResearchNote persists note with created_at", async () => {
    const repo: ResearchRepository = {
      insertNote: vi.fn(async (note) => note),
      insertArtifact: vi.fn(async (artifact) => artifact),
    };
    const service = makeResearchService(repo);

    await Effect.runPromise(
      service.appendResearchNote({
        id: "note-1",
        title: "Investigation",
      })
    );

    expect(repo.insertNote).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "note-1",
        title: "Investigation",
        created_at: expect.any(String),
      })
    );
  });

  it("createArtifact maps repository errors to domain validation errors", async () => {
    const repo: ResearchRepository = {
      insertNote: vi.fn(async (note) => note),
      insertArtifact: vi.fn(async () => {
        throw new Error("db down");
      }),
    };
    const service = makeResearchService(repo);

    const error = await Effect.runPromise(
      service
        .createArtifact({
          id: "artifact-1",
          artifact_type: "report",
          storage_path: "s3://bucket/report.md",
        })
        .pipe(Effect.flip)
    );
    expect(error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Failed to create artifact",
    });
  });
});
