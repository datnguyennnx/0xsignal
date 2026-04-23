import { Context } from "effect";
import type { AgentAction, AgentPlan, AgentSession } from "../../schemas/agent";

export interface AgentRepository {
  readonly insertSession: (session: AgentSession) => Promise<AgentSession>;
  readonly getSession: (id: string) => Promise<AgentSession | null>;
  readonly insertPlan: (plan: AgentPlan) => Promise<AgentPlan>;
  readonly getPlansBySession: (sessionId: string) => Promise<AgentPlan[]>;
  readonly insertAction: (action: AgentAction) => Promise<AgentAction>;
  readonly getActionsBySession: (sessionId: string) => Promise<AgentAction[]>;
}

export const AgentRepository = Context.GenericTag<AgentRepository>("@services/AgentRepository");
