import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import type { StrategyRepository } from "../../ports/strategy-repository";
import { makeStrategyService } from "../service";
import { DomainError } from "../../errors";

const succeed = <T>(val: T) => Effect.succeed(val);
const fail = (err: unknown) =>
  Effect.fail(new DomainError({ code: "INTERNAL_ERROR", message: String(err), cause: err }));

describe("strategy service", () => {
  it("maps postgres unique violation to already exists domain error", async () => {
    const repo: StrategyRepository = {
      insertDefinition: vi.fn().mockReturnValue(fail({ code: "23505" })),
      insertVersion: vi.fn().mockImplementation((version) => succeed(version)),
      insertChangeRecord: vi.fn().mockImplementation((record) => succeed(record)),
      getHistory: vi.fn().mockReturnValue(succeed(null)),
    };

    const service = makeStrategyService(repo);

    const duplicateError = await Effect.runPromise(
      service
        .createStrategyDefinition({
          id: "def-1",
          slug: "alpha",
          name: "Alpha",
          market_type: "crypto",
          owner_type: "user",
        })
        .pipe(Effect.flip)
    );
    expect(duplicateError).toMatchObject({
      code: "ALREADY_EXISTS",
    });
  });

  it("getStrategyHistory returns not found when missing", async () => {
    const repo: StrategyRepository = {
      insertDefinition: vi.fn().mockImplementation((definition) => succeed(definition)),
      insertVersion: vi.fn().mockImplementation((version) => succeed(version)),
      insertChangeRecord: vi.fn().mockImplementation((record) => succeed(record)),
      getHistory: vi.fn().mockReturnValue(succeed(null)),
    };

    const service = makeStrategyService(repo);
    const missingError = await Effect.runPromise(
      service.getStrategyHistory("missing").pipe(Effect.flip)
    );
    expect(missingError).toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
