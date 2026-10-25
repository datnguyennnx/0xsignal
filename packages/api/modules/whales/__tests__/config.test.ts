import { describe, expect, it } from "vitest";
import { ConfigProvider, Effect, Layer } from "effect";
import { WhaleConfig, WhaleConfigLayer } from "../config";

const resolve = (env: Record<string, string>) =>
  Effect.gen(function* () {
    return yield* WhaleConfig;
  }).pipe(
    Effect.provide(
      WhaleConfigLayer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))),
    ),
  );

describe("whale config wallet poll cap", () => {
  it("defaults to the 50-wallet ceiling", async () => {
    const config = await Effect.runPromise(resolve({}));
    expect(config.maxWalletsPerPoll).toBe(50);
  });

  it("accepts the ceiling itself", async () => {
    const config = await Effect.runPromise(resolve({ WHALE_MAX_WALLETS_PER_POLL: "50" }));
    expect(config.maxWalletsPerPoll).toBe(50);
  });

  it("fails startup instead of clamping an over-large value", async () => {
    const error = await Effect.runPromise(
      Effect.flip(resolve({ WHALE_MAX_WALLETS_PER_POLL: "100" })),
    );
    expect(error.message).toContain("WHALE_MAX_WALLETS_PER_POLL=100");
    expect(error.message).toContain("50");
  });
});
