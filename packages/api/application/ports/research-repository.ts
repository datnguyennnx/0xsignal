import { Context, Effect } from "effect";
import type { Artifact, ResearchNote } from "../../schemas/research";
import { DomainError } from "../errors";

export interface ResearchRepository {
  readonly insertNote: (note: ResearchNote) => Effect.Effect<ResearchNote, DomainError>;
  readonly getNotesBySession: (sessionId: string) => Effect.Effect<ResearchNote[], DomainError>;
  readonly getNotesByStrategy: (strategyId: string) => Effect.Effect<ResearchNote[], DomainError>;
  readonly insertArtifact: (artifact: Artifact) => Effect.Effect<Artifact, DomainError>;
  readonly getArtifactsByRun: (runId: string) => Effect.Effect<Artifact[], DomainError>;
}

export const ResearchRepository = Context.GenericTag<ResearchRepository>(
  "@services/ResearchRepository"
);
