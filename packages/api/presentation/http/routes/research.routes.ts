/** Research Routes - /api/research */

import type { ResearchServices } from "../../../application/research";

export const makeResearchRoutes = (services: ResearchServices) => ({
  appendNote: (body: {
    title: string;
    content_markdown?: string;
    session_id?: string;
    run_id?: string;
    strategy_version_id?: string;
    tags?: string[];
  }) =>
    services.appendResearchNote({
      id: crypto.randomUUID(),
      title: body.title,
      content_markdown: body.content_markdown,
      session_id: body.session_id,
      run_id: body.run_id,
      strategy_version_id: body.strategy_version_id,
      tags: body.tags,
    }),

  createArtifact: (body: {
    run_id?: string;
    strategy_version_id?: string;
    artifact_type: "chart" | "report" | "model" | "data" | "config" | "log";
    storage_path: string;
    content_type?: string;
    size_bytes?: number;
    metadata?: unknown;
  }) =>
    services.createArtifact({
      id: crypto.randomUUID(),
      run_id: body.run_id,
      strategy_version_id: body.strategy_version_id,
      artifact_type: body.artifact_type,
      storage_path: body.storage_path,
      content_type: body.content_type,
      size_bytes: body.size_bytes,
      metadata: body.metadata,
    }),
});

export type ResearchRoutes = ReturnType<typeof makeResearchRoutes>;
