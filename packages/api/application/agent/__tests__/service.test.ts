import { describe, it, expect, vi } from "vitest";
import { Effect } from "effect";
import type { AgentRepository } from "../../ports/agent-repository";
import { makeAgentService } from "../service";

describe("agent service", () => {
  it("openSession persists pending session with generated timestamp", async () => {
    const repo: AgentRepository = {
      insertSession: vi.fn(async (session) => session),
      getSession: vi.fn(async () => null),
      insertPlan: vi.fn(async (plan) => plan),
      getPlansBySession: vi.fn(),
      insertAction: vi.fn(async (action) => action),
      getActionsBySession: vi.fn(),
    };

    const service = makeAgentService(repo);
    const result = await Effect.runPromise(
      service.openSession({
        id: "session-1",
        source: "test",
        objective: "verify",
      })
    );

    expect(result.id).toBe("session-1");
    expect(result.status).toBe("pending");
    expect(repo.insertSession).toHaveBeenCalledTimes(1);
    expect(repo.insertSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "session-1",
        status: "pending",
        started_at: expect.any(String),
      })
    );
  });

  it("getSession fails with not found error", async () => {
    const repo: AgentRepository = {
      insertSession: vi.fn(async (session) => session),
      getSession: vi.fn(async () => null),
      insertPlan: vi.fn(async (plan) => plan),
      getPlansBySession: vi.fn(),
      insertAction: vi.fn(async (action) => action),
      getActionsBySession: vi.fn(),
    };

    const service = makeAgentService(repo);
    const error = await Effect.runPromise(service.getSession("missing").pipe(Effect.flip));
    expect(error).toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
