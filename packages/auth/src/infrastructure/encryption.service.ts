import { Config, Context, Effect, Layer, Match, Option } from "effect";
import { EncryptionFailed } from "../domain/errors";

export interface EncryptionServicePort {
  readonly encrypt: (plaintext: string) => Effect.Effect<string, EncryptionFailed>;
  readonly decrypt: (ciphertext: string) => Effect.Effect<string, EncryptionFailed>;
}

export class EncryptionService extends Context.Service<EncryptionService, EncryptionServicePort>()(
  "EncryptionService"
) {}

const ALGORITHM = "AES-GCM";

async function getKey(secret: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HKDF" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(16),
      info: new TextEncoder().encode("auth-encryption"),
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

const disabledEncryptionService = EncryptionService.of({
  encrypt: () => Effect.die(new Error("Encryption is not configured (missing ENCRYPTION_SECRET)")),
  decrypt: () => Effect.die(new Error("Encryption is not configured (missing ENCRYPTION_SECRET)")),
});

export const EncryptionServiceLayer: Layer.Layer<EncryptionService, never, never> = Layer.effect(
  EncryptionService,
  Effect.gen(function* () {
    const maybeSecret = yield* Config.option(Config.string("ENCRYPTION_SECRET")).pipe(Effect.orDie);
    if (Option.isNone(maybeSecret)) {
      yield* Effect.logWarning("ENCRYPTION_SECRET not set — encryption disabled");
      return disabledEncryptionService;
    }
    const secret = maybeSecret.value;
    const result = yield* Effect.promise(() => getKey(secret)).pipe(
      Effect.matchEffect({
        onSuccess: (key) => Effect.succeed({ _tag: "ok" as const, key }),
        onFailure: () =>
          Effect.logWarning(`Encryption key derivation failed — encryption disabled`).pipe(
            Effect.andThen(Effect.succeed({ _tag: "fail" as const }))
          ),
      })
    );
    return Match.value(result).pipe(
      Match.when({ _tag: "fail" }, () => disabledEncryptionService),
      Match.orElse(({ key }) =>
        EncryptionService.of({
          encrypt: (plaintext) =>
            Effect.tryPromise({
              try: async () => {
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const encrypted = await crypto.subtle.encrypt(
                  { name: ALGORITHM, iv },
                  key,
                  new TextEncoder().encode(plaintext)
                );
                const combined = new Uint8Array(iv.length + encrypted.byteLength);
                combined.set(iv);
                combined.set(new Uint8Array(encrypted), iv.length);
                return btoa(String.fromCharCode(...combined));
              },
              catch: (cause) => new EncryptionFailed({ cause }),
            }),
          decrypt: (ciphertext) =>
            Effect.tryPromise({
              try: async () => {
                const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
                const iv = combined.slice(0, 12);
                const data = combined.slice(12);
                const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, data);
                return new TextDecoder().decode(decrypted);
              },
              catch: (cause) => new EncryptionFailed({ cause }),
            }),
        })
      )
    );
  })
);
