import { vi } from "vitest";
import { type Context, Effect, Layer, Redacted } from "effect";
import { HttpTransport, InfoClient, type ExchangeClient } from "@nktkas/hyperliquid";
import { HyperliquidClient } from "../../../integrations/hyperliquid/data-sources/hyperliquid-client";
import { ExchangeService } from "../index";
import { exchangeServiceLayer } from "../service";
import { exchangeCredentialsLayer } from "../../../integrations/hyperliquid/data-sources/exchange-credentials";
import {
  HyperliquidValidationError,
  InsufficientMarginError,
  HyperliquidInternalError,
} from "../../../shared/errors";
import {
  ExchangeAccountRepo,
  ExchangeCredentialRepo,
  AccountNotFound,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
} from "@0xsignal/auth";

// Constants

export const VALID_PRIVATE_KEY = "0x" + "a".repeat(64);
export const USER_A = "user-a";
export const USER_B = "user-b";

// Types derived from the mocked service contracts

export type AccountRepoShape = Context.Service.Shape<typeof ExchangeAccountRepo>;
export type CredRepoShape = Context.Service.Shape<typeof ExchangeCredentialRepo>;

type AccountRecord = Effect.Success<ReturnType<AccountRepoShape["create"]>>;
type CredentialRecord = Effect.Success<ReturnType<CredRepoShape["create"]>>;
type DecryptedAgent = Effect.Success<ReturnType<CredRepoShape["getDecryptedAgent"]>>;
type MetaResponse = Awaited<ReturnType<InfoClient["meta"]>>;

// SDK success payloads — the exchange service returns these verbatim.

export const ORDER_OK: Awaited<ReturnType<ExchangeClient["order"]>> = {
  status: "ok",
  response: { type: "order", data: { statuses: ["waitingForFill"] } },
};

export const CANCEL_OK: Awaited<ReturnType<ExchangeClient["cancel"]>> = {
  status: "ok",
  response: { type: "cancel", data: { statuses: ["success"] } },
};

export const LEVERAGE_OK: Awaited<ReturnType<ExchangeClient["updateLeverage"]>> = {
  status: "ok",
  response: { type: "default" },
};

// Mock instances

export const mockInfoInstance = {
  meta: vi.fn<InfoClient["meta"]>(),
};

export const makeMetaResponse = (names: readonly string[]): MetaResponse => ({
  universe: names.map((name) => ({ name, szDecimals: 0, maxLeverage: 1, marginTableId: 0 })),
  marginTables: [],
  collateralToken: 0,
});

export const makeMockHLClient = () =>
  Layer.succeed(
    HyperliquidClient,
    HyperliquidClient.of({
      info: Object.assign(new InfoClient({ transport: new HttpTransport() }), mockInfoInstance),
    }),
  );

// Placeholder factories

export const makePlaceholderAccount = (overrides?: Partial<AccountRecord>): AccountRecord => ({
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

export const makePlaceholderCredential = (
  overrides?: Partial<CredentialRecord>,
): CredentialRecord => ({
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

export const makeDecryptedCredential = (overrides?: Partial<DecryptedAgent>): DecryptedAgent => ({
  privateKey: Redacted.make(VALID_PRIVATE_KEY),
  walletAddress: "0xMASTER",
  agentAddress: "0xAGENT",
  exchange: "hyperliquid",
  permissions: [],
  ...overrides,
});

// Default mock repos

export const defaultMockAccountRepo = {
  create: vi
    .fn<AccountRepoShape["create"]>()
    .mockReturnValue(Effect.succeed(makePlaceholderAccount())),
  findById: vi
    .fn<AccountRepoShape["findById"]>()
    .mockReturnValue(Effect.fail(new AccountNotFound({ accountId: "nope" }))),
  findByUserId: vi.fn<AccountRepoShape["findByUserId"]>().mockReturnValue(Effect.succeed([])),
  findPrimary: vi
    .fn<AccountRepoShape["findPrimary"]>()
    .mockReturnValue(Effect.succeed(makePlaceholderAccount())),
  findWithDescendants: vi
    .fn<AccountRepoShape["findWithDescendants"]>()
    .mockReturnValue(Effect.succeed([])),
  resolveMasterWallet: vi
    .fn<AccountRepoShape["resolveMasterWallet"]>()
    .mockReturnValue(Effect.succeed("0xMASTER")),
  setPrimary: vi.fn<AccountRepoShape["setPrimary"]>().mockReturnValue(Effect.succeed(void 0)),
  deactivate: vi.fn<AccountRepoShape["deactivate"]>().mockReturnValue(Effect.succeed(void 0)),
};

export const defaultMockCredRepo = {
  create: vi
    .fn<CredRepoShape["create"]>()
    .mockReturnValue(Effect.succeed(makePlaceholderCredential())),
  getActiveForAccount: vi
    .fn<CredRepoShape["getActiveForAccount"]>()
    .mockReturnValue(Effect.succeed(makePlaceholderCredential())),
  getDecryptedAgent: vi
    .fn<CredRepoShape["getDecryptedAgent"]>()
    .mockReturnValue(Effect.succeed(makeDecryptedCredential())),
  getDecryptedEoa: vi
    .fn<CredRepoShape["getDecryptedEoa"]>()
    .mockReturnValue(Effect.die(new Error("not implemented"))),
  rotate: vi
    .fn<CredRepoShape["rotate"]>()
    .mockReturnValue(Effect.succeed(makePlaceholderCredential({ id: "cred-2" }))),
  revoke: vi.fn<CredRepoShape["revoke"]>().mockReturnValue(Effect.succeed(void 0)),
  setVerified: vi.fn<CredRepoShape["setVerified"]>().mockReturnValue(Effect.succeed(void 0)),
  markUsed: vi.fn<CredRepoShape["markUsed"]>().mockReturnValue(Effect.succeed(void 0)),
  getForVerification: vi
    .fn<CredRepoShape["getForVerification"]>()
    .mockReturnValue(Effect.die(new Error("not implemented"))),
  recordAuditEvent: vi
    .fn<CredRepoShape["recordAuditEvent"]>()
    .mockReturnValue(Effect.succeed(void 0)),
};

// Test layer factory

export const makeTestLayer = (
  accountRepoOverrides?: Partial<typeof defaultMockAccountRepo>,
  credRepoOverrides?: Partial<typeof defaultMockCredRepo>,
) => {
  const mergedAccount = { ...defaultMockAccountRepo, ...accountRepoOverrides };
  const mergedCred = { ...defaultMockCredRepo, ...credRepoOverrides };

  return exchangeServiceLayer.pipe(
    Layer.provideMerge(exchangeCredentialsLayer),
    Layer.provideMerge(Layer.succeed(ExchangeAccountRepo, ExchangeAccountRepo.of(mergedAccount))),
    Layer.provideMerge(
      Layer.succeed(ExchangeCredentialRepo, ExchangeCredentialRepo.of(mergedCred)),
    ),
    Layer.provideMerge(makeMockHLClient()),
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
  exchangeCredentialsLayer,
};
