import type { Artifact, ResearchNote } from "@schemas/research";

export interface ResearchRepository {
  insertNote(note: ResearchNote): Promise<ResearchNote>;
  getNote(id: string): Promise<ResearchNote | null>;
  getNotesBySession(sessionId: string): Promise<ResearchNote[]>;
  getNotesByRun(runId: string): Promise<ResearchNote[]>;
  insertArtifact(artifact: Artifact): Promise<Artifact>;
  getArtifact(id: string): Promise<Artifact | null>;
  getArtifactsByRun(runId: string): Promise<Artifact[]>;
}
