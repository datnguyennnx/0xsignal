import { Context, Effect, Layer } from "effect";
import * as RedactedNs from "effect/Redacted";
import { PostgresConnectionPool } from "@0xsignal/shared/db/postgres";
import type {
  ApiCredential,
  DecryptedAgentCredential,
  DecryptedEoaCredential,
} from "../../domain/exchange-credential";
import {
  AccountNotFound,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
  EncryptionFailed,
  DuplicateLabel,
} from "../../domain/errors";
import { EncryptionService } from "../encryption.service";
import { pgExchangeCredentialRepo } from "./exchange-credential.repo.pg";

// Input types

export interface CreateApiCredentialParams {
  readonly userId: string;
  readonly accountId: string;
  readonly credentialSubtype: "agent" | "eoa" | "hardware";
  readonly label?: string;
  readonly agentAddress?: string;
  /** Plaintext agent private key — will be encrypted before storage */
  readonly agentKey?: RedactedNs.Redacted<string>;
  /** Plaintext EOA private key — will be encrypted before storage */
  readonly eoaKey?: string;
  readonly derivationPath?: string;
  readonly permissions?: readonly string[];
  readonly ipWhitelist?: readonly string[];
  readonly expiresAt?: string;
  readonly encryptionVersion?: number;
  readonly isVerified?: boolean;
  readonly metadata?: Record<string, unknown>;
}

// Port interface

export interface ExchangeCredentialRepoPort {
  readonly create: (
    params: CreateApiCredentialParams,
  ) => Effect.Effect<ApiCredential, EncryptionFailed | DuplicateLabel | AccountNotFound>;

  readonly getActiveForAccount: (
    accountId: string,
    userId: string,
    subtype?: string,
  ) => Effect.Effect<ApiCredential, CredentialNotFound>;

  readonly getDecryptedAgent: (
    credentialId: string,
    userId: string,
  ) => Effect.Effect<
    DecryptedAgentCredential,
    | CredentialNotFound
    | CredentialRevoked
    | CredentialExpired
    | CredentialUnverified
    | EncryptionFailed
    | AccountNotFound
  >;

  readonly getDecryptedEoa: (
    credentialId: string,
    userId: string,
  ) => Effect.Effect<
    DecryptedEoaCredential,
    | CredentialNotFound
    | CredentialRevoked
    | CredentialExpired
    | CredentialUnverified
    | EncryptionFailed
    | AccountNotFound
  >;

  readonly rotate: (
    oldId: string,
    newParams: CreateApiCredentialParams,
  ) => Effect.Effect<
    ApiCredential,
    CredentialNotFound | AccountNotFound | EncryptionFailed | DuplicateLabel
  >;

  readonly revoke: (
    id: string,
    reason: string,
    userId: string,
  ) => Effect.Effect<void, CredentialNotFound>;

  readonly setVerified: (id: string, userId: string) => Effect.Effect<void, CredentialNotFound>;

  readonly markUsed: (id: string) => Effect.Effect<void, never>;

  readonly getForVerification: (
    credentialId: string,
    userId: string,
  ) => Effect.Effect<
    {
      readonly privateKey: RedactedNs.Redacted<string>;
      readonly agentAddress: string;
      readonly accountId: string;
      readonly exchangeSlug: string;
      readonly masterWalletAddress: string;
    },
    CredentialNotFound | CredentialRevoked | CredentialExpired | EncryptionFailed | AccountNotFound
  >;

  readonly recordAuditEvent: (
    action: string,
    params: {
      readonly userId: string;
      readonly accountId?: string;
      readonly credentialId?: string;
      readonly context?: Record<string, unknown>;
    },
  ) => Effect.Effect<void, never>;
}

// Context Service

export class ExchangeCredentialRepo extends Context.Service<
  ExchangeCredentialRepo,
  ExchangeCredentialRepoPort
>()("ExchangeCredentialRepo") {}

// Layer

export const ExchangeCredentialRepoLayer: Layer.Layer<
  ExchangeCredentialRepo,
  never,
  PostgresConnectionPool | EncryptionService
> = Layer.effect(
  ExchangeCredentialRepo,
  Effect.gen(function* () {
    const pg = yield* PostgresConnectionPool;
    const enc = yield* EncryptionService;

    if (pg === null) {
      return yield* Effect.die(
        new Error("PostgresConnectionPool required but was null — provide a proper pool"),
      );
    }

    return pgExchangeCredentialRepo(pg, enc);
  }),
);

// Note: DB row mapping functions (ts, mapCredentialRow) live in
// exchange-credential.repo.pg.ts — not exported from this facade.
