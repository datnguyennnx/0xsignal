import { Effect, Layer } from "effect";
import { HyperliquidClient } from "./hyperliquid-client";
import { CredentialVerifier } from "./credential-verifier";
import { CredentialVerificationError } from "./credential-verifier.error";

export const credentialVerifierLayer: Layer.Layer<CredentialVerifier, never, HyperliquidClient> =
  Layer.effect(
    CredentialVerifier,
    Effect.gen(function* () {
      const { info } = yield* HyperliquidClient;

      return CredentialVerifier.of({
        hasAccountState: (address) =>
          Effect.tryPromise({
            try: () => info.clearinghouseState({ user: address }),
            catch: (cause) =>
              new CredentialVerificationError({
                message:
                  cause instanceof Error ? cause.message : "Unknown error from Hyperliquid API",
                cause,
              }),
          }).pipe(Effect.map((state) => state !== null)),
      });
    }),
  );
