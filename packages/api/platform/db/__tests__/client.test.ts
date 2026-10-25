import { describe, expect, it } from "vitest";
import { Effect, Logger } from "effect";
import { bridgePoolErrors } from "../client";

const fakePool = () => {
  const listeners: Array<(err: Error) => void> = [];
  return {
    pool: {
      on: (_event: "error", listener: (err: Error) => void) => {
        listeners.push(listener);
      },
    },
    emit: (err: Error) => {
      for (const listener of listeners) listener(err);
    },
  };
};

describe("postgres pool error bridge", () => {
  it("logs every pool error event at Error level without starting a second runtime", async () => {
    const levels: string[] = [];
    const sink = Logger.make<unknown, void>(({ logLevel }) => {
      levels.push(logLevel);
    });
    const { pool, emit } = fakePool();

    const program = Effect.gen(function* () {
      yield* bridgePoolErrors(pool);
      emit(new Error("connection reset"));
      emit(new Error("connection reset again"));
      yield* Effect.sleep("50 millis");
    });

    await Effect.runPromise(program.pipe(Effect.scoped, Effect.provide(Logger.layer([sink]))));

    expect(levels).toEqual(["Error", "Error"]);
  });
});
