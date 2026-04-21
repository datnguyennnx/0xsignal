import { Effect } from "effect";
import { ResearchServicesTag } from "../../../../application/research/service";
import { validationError } from "../../../../application/errors";

export const appendResearchNoteTool = {
  name: "append_research_note",
  description: "Append a research note with markdown content",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      content_markdown: { type: "string" },
      session_id: { type: "string" },
      run_id: { type: "string" },
      strategy_version_id: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["title"],
  },
  execute: (input: {
    title: string;
    content_markdown?: string;
    session_id?: string;
    run_id?: string;
    strategy_version_id?: string;
    tags?: readonly string[];
  }) => {
    if (!input.session_id && !input.run_id && !input.strategy_version_id) {
      return Effect.fail(
        validationError(
          "append_research_note requires at least one anchor: session_id, run_id, or strategy_version_id"
        )
      );
    }

    return Effect.flatMap(ResearchServicesTag, (researchServices) =>
      researchServices
        .appendResearchNote({
          id: crypto.randomUUID(),
          title: input.title,
          content_markdown: input.content_markdown,
          session_id: input.session_id,
          run_id: input.run_id,
          strategy_version_id: input.strategy_version_id,
          tags: input.tags === undefined ? undefined : [...input.tags],
        })
        .pipe(Effect.map((note) => ({ note_id: note.id, title: note.title })))
    );
  },
};
