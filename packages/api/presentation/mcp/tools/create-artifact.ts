import { Effect } from "effect";
import { getMcpDependencies } from "../server";

export const createArtifactTool = {
  name: "create_artifact",
  description:
    "Create an artifact (chart, report, model, data, config, or log) for a run or strategy version",
  inputSchema: {
    type: "object",
    properties: {
      artifact_type: {
        type: "string",
        enum: ["chart", "report", "model", "data", "config", "log"],
      },
      storage_path: { type: "string" },
      run_id: { type: "string" },
      strategy_version_id: { type: "string" },
      content_type: { type: "string" },
      size_bytes: { type: "integer" },
      metadata: { type: "object", additionalProperties: true },
    },
    required: ["artifact_type", "storage_path"],
  },
  execute: (input: {
    artifact_type: "chart" | "report" | "model" | "data" | "config" | "log";
    storage_path: string;
    run_id?: string;
    strategy_version_id?: string;
    content_type?: string;
    size_bytes?: number;
    metadata?: Record<string, unknown>;
  }) => {
    const deps = getMcpDependencies();
    return deps.researchServices
      .createArtifact({
        id: crypto.randomUUID(),
        artifact_type: input.artifact_type,
        storage_path: input.storage_path,
        run_id: input.run_id,
        strategy_version_id: input.strategy_version_id,
        content_type: input.content_type,
        size_bytes: input.size_bytes,
        metadata: input.metadata,
      })
      .pipe(
        Effect.map((artifact) => ({
          artifact_id: artifact.id,
          artifact_type: artifact.artifact_type,
          storage_path: artifact.storage_path,
        }))
      );
  },
};
