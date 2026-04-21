import type { AgentAction, AgentPlan, AgentSession } from "../../schemas/agent";

export interface AgentRepository {
  insertSession(session: AgentSession): Promise<AgentSession>;
  getSession(id: string): Promise<AgentSession | null>;
  insertPlan(plan: AgentPlan): Promise<AgentPlan>;
  insertAction(action: AgentAction): Promise<AgentAction>;
}
