import type { Artifact, ResearchNote } from "../../schemas/research";

export interface ResearchRepository {
  insertNote(note: ResearchNote): Promise<ResearchNote>;
  insertArtifact(artifact: Artifact): Promise<Artifact>;
}
