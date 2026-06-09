import { vi } from "vitest";
import { Effect, Layer, Redacted } from "effect";
import type { InfoClient } from "@nktkas/hyperliquid";
import { HyperliquidClient } from "../../hyperliquid/contracts";
import { ExchangeService } from "../contracts";
import { exchangeServiceLayer } from "../service";
import {
  HyperliquidValidationError,
  InsufficientMarginError,
  HyperliquidInternalError,
} from "../../../domain/errors";
import {
  ExchangeAccountRepo,
  ExchangeCredentialRepo,
  AccountNotFound,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
} from "@0xsignal/auth";

// ── Constants ─────────────────────────────────────────────────────────

export const VALID_PRIVATE_KEY = "0x" + "a".repeat(64);
export const USER_A = "user-a";
export const USER_B = "user-b";

// ── Mock instances ────────────────────────────────────────────────────

export const mockInfoInstance = {
  meta: vi.fn(),
};

export const makeMockHLClient = () =>
  Layer.succeed(
    HyperliquidClient,
    HyperliquidClient.of({
      info: mockInfoInstance as unknown as InfoClient,
    })
  );

// ── Placeholder factories ─────────────────────────────────────────────

export const makePlaceholderAccount = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "acct-1",
  userId: USER_A,
  exchangeId: "hl-exchange",
  nodeType: "wallet",
  walletAddress: "0xMASTER",
  label: "Master",
  sortOrder: 0,
  isActive: true,
  isPrimary: true,
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const makePlaceholderCredential = (overrides?: Partial<Record<string, unknown>>) => ({
  id: "cred-1",
  accountId: "acct-1",
  userId: USER_A,
  credentialSubtype: "agent",
  label: "Agent Key",
  agentAddress: "0xAGENT",
  encAgentKey: "encrypted-key-placeholder",
  permissions: [],
  isActive: true,
  isRevoked: false,
  isVerified: true,
  encryptionVersion: 1,
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const makeDecryptedCredential = (overrides?: Partial<Record<string, unknown>>) => ({
  privateKey: Redacted.make(VALID_PRIVATE_KEY),
  walletAddress: "0xMASTER",
  vaultAddress: undefined,
  agentAddress: "0xAGENT",
  exchange: "hyperliquid",
  permissions: [],
  ...overrides,
});

// ── Default mock repos ────────────────────────────────────────────────

export const defaultMockAccountRepo = {
  create: vi.fn().mockReturnValue(Effect.succeed(makePlaceholderAccount())),
  findById: vi.fn().mockReturnValue(Effect.fail(new AccountNotFound({ accountId: "nope" }))),
  findByUserId: vi.fn().mockReturnValue(Effect.succeed([])),
  findPrimary: vi.fn().mockReturnValue(Effect.succeed(makePlaceholderAccount())),
  findWithDescendants: vi.fn().mockReturnValue(Effect.succeed([])),
  resolveMasterWallet: vi.fn().mockReturnValue(Effect.succeed("0xMASTER")),
  setPrimary: vi.fn().mockReturnValue(Effect.succeed(void 0)),
  deactivate: vi.fn().mockReturnValue(Effect.succeed(void 0)),
};

export const defaultMockCredRepo = {
  create: vi.fn().mockReturnValue(Effect.succeed(makePlaceholderCredential())),
  getActiveForAccount: vi.fn().mockReturnValue(Effect.succeed(makePlaceholderCredential())),
  getDecryptedAgent: vi.fn().mockReturnValue(Effect.succeed(makeDecryptedCredential())),
  getDecryptedEoa: vi.fn().mockReturnValue(Effect.die(new Error("not implemented"))),
  rotate: vi.fn().mockReturnValue(Effect.succeed(makePlaceholderCredential({ id: "cred-2" }))),
  revoke: vi.fn().mockReturnValue(Effect.succeed(void 0)),
  setVerified: vi.fn().mockReturnValue(Effect.succeed(void 0)),
  markUsed: vi.fn().mockReturnValue(Effect.succeed(void 0)),
};

// ── Test layer factory ────────────────────────────────────────────────

export const makeTestLayer = (
  accountRepoOverrides?: Partial<typeof defaultMockAccountRepo>,
  credRepoOverrides?: Partial<typeof defaultMockCredRepo>
) => {
  const mergedAccount = { ...defaultMockAccountRepo, ...accountRepoOverrides };
  const mergedCred = { ...defaultMockCredRepo, ...credRepoOverrides };

  return exchangeServiceLayer.pipe(
    Layer.provideMerge(
      Layer.succeed(ExchangeAccountRepo, ExchangeAccountRepo.of(mergedAccount as any))
    ),
    Layer.provideMerge(
      Layer.succeed(ExchangeCredentialRepo, ExchangeCredentialRepo.of(mergedCred as any))
    ),
    Layer.provideMerge(makeMockHLClient())
  );
};

export {
  HyperliquidValidationError,
  InsufficientMarginError,
  HyperliquidInternalError,
  AccountNotFound,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
  ExchangeAccountRepo,
  ExchangeCredentialRepo,
  ExchangeService,
  exchangeServiceLayer,
  HyperliquidClient,
  Effect,
  Layer,
  Redacted,
};
