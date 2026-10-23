import { Effect } from "effect";
import type { Redacted } from "effect/Redacted";
import * as RedactedNs from "effect/Redacted";
import type { EncryptionFailed } from "../../domain/errors";
import type { EncryptionServicePort } from "../encryption.service";

export type EncryptedCredentialSecrets = {
  readonly encAgentKey: string | undefined;
  readonly encEoaKey: string | undefined;
};

type CredentialSecretInput = {
  readonly credentialSubtype: "agent" | "eoa" | "hardware";
  readonly agentKey?: Redacted;
  readonly eoaKey?: string;
};

const isPresent = (value: string | null | undefined): value is string =>
  value !== undefined && value !== null && value !== "";

export const encryptCredentialSecrets = (
  enc: EncryptionServicePort,
  params: CredentialSecretInput,
): Effect.Effect<EncryptedCredentialSecrets, EncryptionFailed> =>
  Effect.gen(function* () {
    let encAgentKey: string | undefined;
    let encEoaKey: string | undefined;

    if (params.credentialSubtype === "agent" && params.agentKey !== undefined) {
      encAgentKey = yield* enc.encrypt(RedactedNs.value(params.agentKey));
    }
    if (params.credentialSubtype === "eoa" && isPresent(params.eoaKey)) {
      encEoaKey = yield* enc.encrypt(params.eoaKey);
    }

    return { encAgentKey, encEoaKey };
  });

export const decryptCredentialKey = (
  enc: EncryptionServicePort,
  ciphertext: string | null,
  missingSecretMessage: string,
): Effect.Effect<Redacted, EncryptionFailed> =>
  Effect.gen(function* () {
    if (!isPresent(ciphertext)) {
      return yield* Effect.die(new Error(missingSecretMessage));
    }
    return RedactedNs.make(yield* enc.decrypt(ciphertext));
  });
