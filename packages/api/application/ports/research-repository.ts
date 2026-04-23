import { Context } from "effect";
import type { Artifact, ResearchNote } from "../../schemas/research";

export interface ResearchRepository {
  readonly insertNote: (note: ResearchNote) => Promise<ResearchNote>;
  readonly getNotesBySession: (sessionId: string) => Promise<ResearchNote[]>;
  readonly getNotesByStrategy: (strategyId: string) => Promise<ResearchNote[]>;
  readonly insertArtifact: (artifact: Artifact) => Promise<Artifact>;
  readonly getArtifactsByRun: (runId: string) => Promise<Artifact[]>;
}

export const ResearchRepository = Context.GenericTag<ResearchRepository>(
  "@services/ResearchRepository"
);
