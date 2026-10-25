import { describe, expect, it } from "vitest";
import { Effect, Layer, Option, Ref } from "effect";
import { guardWithLeaderLock, LeaderLock, type LeaderLockPort } from "../leader-lock";

const leaderLock = (leader: boolean): LeaderLockPort => ({
  runExclusive: (_key, effect) =>
    leader ? effect.pipe(Effect.map(Option.some)) : Effect.succeed(Option.none()),
});

const runGuarded = (leader: boolean) =>
  Effect.gen(function* () {
    const ticks = yield* Ref.make(0);
    yield* guardWithLeaderLock(
      41_001,
      Ref.update(ticks, (n) => n + 1),
    ).pipe(Effect.provideService(LeaderLock, leaderLock(leader)));
    return yield* Ref.get(ticks);
  });

describe("leader lock gate", () => {
  it("runs the background effect on the leader", async () => {
    await expect(Effect.runPromise(runGuarded(true))).resolves.toBe(1);
  });

  it("skips the background effect for a non-leader", async () => {
    await expect(Effect.runPromise(runGuarded(false))).resolves.toBe(0);
  });

  it("runs the background effect when no LeaderLock is wired", async () => {
    const ticks = await Effect.runPromise(
      Effect.gen(function* () {
        const counter = yield* Ref.make(0);
        yield* guardWithLeaderLock(
          41_001,
          Ref.update(counter, (n) => n + 1),
        );
        return yield* Ref.get(counter);
      }).pipe(Effect.provide(Layer.empty)),
    );

    expect(ticks).toBe(1);
  });
});
