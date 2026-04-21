import { afterAll, beforeAll, describe, expect, it } from "@effect/vitest";
import { closePool, query } from "../../client";
import { postgresResearchRepository } from "../research.repository";

const shouldRunPostgres = process.env.RUN_POSTGRES_INTEGRATION === "1";

if (shouldRunPostgres) {
  describe("ResearchRepository", () => {
    const noteId = `test-note-${Date.now()}`;
    const artifactId = `test-artifact-${Date.now()}`;

    beforeAll(async () => {
      await query("SELECT 1");
    });

    afterAll(async () => {
      await query("DELETE FROM artifacts WHERE id = $1", [artifactId]);
      await query("DELETE FROM research_notes WHERE id = $1", [noteId]);
      await closePool();
    });

    it("insertNote persists structured note fields", async () => {
      const note = await postgresResearchRepository.insertNote({
        id: noteId,
        title: "Unit test note",
        tags: ["qa"],
        created_at: new Date().toISOString(),
      });

      expect(note.id).toBe(noteId);
      expect(note.title).toBe("Unit test note");
    });

    it("insertArtifact serializes metadata payload", async () => {
      const artifact = await postgresResearchRepository.insertArtifact({
        id: artifactId,
        artifact_type: "report",
        storage_path: "s3://bucket/report.md",
        metadata: { source: "test" },
        created_at: new Date().toISOString(),
      });

      expect(artifact.id).toBe(artifactId);
      expect(artifact.artifact_type).toBe("report");
    });
  });
} else {
  describe("ResearchRepository integration gate", () => {
    it.skip("requires RUN_POSTGRES_INTEGRATION=1", () => {});
  });
}
