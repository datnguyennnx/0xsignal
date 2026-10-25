import { Effect } from "effect";
import type { AgentRegistration } from "../../domain/agent-registration";

type AgentRegistrationRow = {
  readonly id: string;
  readonly user_id: string;
  readonly agent_address: string;
  readonly label: string | null;
  readonly expires_at: Date | string | null;
  readonly is_verified: boolean;
  readonly created_at: Date | string;
};

const ts = (v: Date | string): string => (v instanceof Date ? v.toISOString() : v);

function mapRow(row: AgentRegistrationRow): AgentRegistration {
  return {
    id: row.id,
    userId: row.user_id,
    agentAddress: row.agent_address,
    ...(row.label !== null && { label: row.label }),
    ...(row.expires_at !== null && { expiresAt: ts(row.expires_at) }),
    isVerified: row.is_verified,
    createdAt: ts(row.created_at),
  };
}

export function pgAgentRegistrationRepo(pg: NonNullable<import("pg").Pool>): {
  readonly listByUserId: (userId: string) => Effect.Effect<readonly AgentRegistration[]>;
} {
  return {
    listByUserId: (userId) =>
      Effect.tryPromise(async () => {
        // The user_id predicate is the isolation boundary; there is no caller-supplied
        // account or address filter that could widen it.
        const result = await pg.query<AgentRegistrationRow>(
          `SELECT id, user_id, agent_address, label, expires_at, is_verified, created_at
           FROM agent_registrations
           WHERE user_id = $1
           ORDER BY created_at DESC`,
          [userId],
        );
        return result.rows.map(mapRow);
      }).pipe(Effect.orDie),
  };
}
