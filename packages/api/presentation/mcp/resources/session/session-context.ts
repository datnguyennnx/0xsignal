import { Effect } from "effect";
import { AgentServices } from "@application/agent";

export interface SessionContextResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export const sessionContextResource = (sessionId: string): SessionContextResource => ({
  uri: `session://${sessionId}/context`,
  name: "Session Context",
  description: `Context details for session ${sessionId}`,
  mimeType: "application/json",
});

export const getSessionContext = (sessionId: string) => {
  return Effect.flatMap(AgentServices, (services) => services.getSession(sessionId)).pipe(
    Effect.map((session) => ({
      resource: sessionContextResource(sessionId),
      content: JSON.stringify({
        id: session.id,
        source: session.source,
        objective: session.objective,
        status: session.status,
        context_scope: session.context_scope,
        actor_kind: session.actor_kind,
        actor_name: session.actor_name,
        started_at: session.started_at,
        ended_at: session.ended_at,
      }),
    }))
  );
};
