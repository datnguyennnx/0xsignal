import { Context, Effect } from "effect";
import type { AgentAction, AgentPlan, AgentSession } from "../../schemas/agent";
import { DomainError } from "../errors";

export interface AgentRepository {
  readonly insertSession: (session: AgentSession) => Effect.Effect<AgentSession, DomainError>;
  readonly getSession: (id: string) => Effect.Effect<AgentSession | null, DomainError>;
  readonly insertPlan: (plan: AgentPlan) => Effect.Effect<AgentPlan, DomainError>;
  readonly getPlansBySession: (sessionId: string) => Effect.Effect<AgentPlan[], DomainError>;
  readonly insertAction: (action: AgentAction) => Effect.Effect<AgentAction, DomainError>;
  readonly getActionsBySession: (sessionId: string) => Effect.Effect<AgentAction[], DomainError>;
}

export const AgentRepository = Context.GenericTag<AgentRepository>("@services/AgentRepository");
