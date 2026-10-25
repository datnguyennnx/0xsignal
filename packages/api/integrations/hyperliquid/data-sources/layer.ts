import { Effect, Layer } from "effect";
import { HyperliquidClient } from "./hyperliquid-client";
import { HyperliquidProvider } from "./types";
import { makeHyperliquidProvider } from "./provider";
import { CredentialVerifier } from "./credential-verifier";
import { CredentialVerificationError } from "./credential-verifier.error";
import { HyperliquidRateLimiter } from "../rate-limit";
import { INFO_WEIGHTS } from "../weights";

export const hyperliquidProviderLayer: Layer.Layer<
  HyperliquidProvider,
  never,
  HyperliquidClient | HyperliquidRateLimiter
> = Layer.effect(HyperliquidProvider, makeHyperliquidProvider());

export const credentialVerifierLayer: Layer.Layer<
  CredentialVerifier,
  never,
  HyperliquidClient | HyperliquidRateLimiter
> = Layer.effect(
  CredentialVerifier,
  Effect.gen(function* () {
    const { info } = yield* HyperliquidClient;
    const limiter = yield* HyperliquidRateLimiter;

    return CredentialVerifier.of({
      hasAccountState: (address) =>
        limiter.acquire(INFO_WEIGHTS.clearinghouseState).pipe(
          Effect.mapError(
            (error) => new CredentialVerificationError({ message: error.message, cause: error }),
          ),
          Effect.flatMap(() =>
            Effect.tryPromise({
              try: () => info.clearinghouseState({ user: address }),
              catch: (cause) =>
                new CredentialVerificationError({
                  message:
                    cause instanceof Error ? cause.message : "Unknown error from Hyperliquid API",
                  cause,
                }),
            }),
          ),
          Effect.map((state) => state !== null),
        ),
    });
  }),
);
