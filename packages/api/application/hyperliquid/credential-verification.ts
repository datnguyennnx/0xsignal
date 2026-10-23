import { Context, type Effect } from "effect";
import type { CredentialVerificationError } from "./credential-verification.error";

export interface CredentialVerifierPort {
  /** True when the exchange returns account state for `address`. */
  readonly hasAccountState: (
    address: string,
  ) => Effect.Effect<boolean, CredentialVerificationError>;
}

export class CredentialVerifier extends Context.Service<
  CredentialVerifier,
  CredentialVerifierPort
>()("CredentialVerifier") {}
