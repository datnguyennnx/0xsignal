import type { AgentAction, AgentPlan, AgentSession } from "@schemas/agent";

export interface AgentRepository {
  insertSession(session: AgentSession): Promise<AgentSession>;
  getSession(id: string): Promise<AgentSession | null>;
  insertPlan(plan: AgentPlan): Promise<AgentPlan>;
  getPlan(id: string): Promise<AgentPlan | null>;
  getPlanBySession(sessionId: string): Promise<AgentPlan[]>;
  insertAction(action: AgentAction): Promise<AgentAction>;
  getAction(id: string): Promise<AgentAction | null>;
  getActionsBySession(sessionId: string): Promise<AgentAction[]>;
}
