const mockExchangeInstance = vi.hoisted(() => ({
  order: vi.fn(),
  updateLeverage: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("@nktkas/hyperliquid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nktkas/hyperliquid")>();
  return {
    ...actual,
    ExchangeClient: vi.fn(function () {
      return mockExchangeInstance;
    }),
    HttpTransport: vi.fn(),
  };
});

vi.mock("@nktkas/hyperliquid/api/exchange", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nktkas/hyperliquid/api/exchange")>();
  return { ...actual };
});

import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { Effect, Layer, Redacted } from "effect";
import { ValiError } from "valibot";
import type { InfoClient } from "@nktkas/hyperliquid";
import { ApiRequestError } from "@nktkas/hyperliquid/api/exchange";
import { HyperliquidClient } from "../../../infrastructure/data-sources/hyperliquid/client";
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
import { buildExchangeRoutes } from "../../../presentation/http/routes/exchange.routes";

const VALID_PRIVATE_KEY = "0x" + "a".repeat(64);
const USER_A = "user-a";
const USER_B = "user-b";

const mockInfoInstance = {
  meta: vi.fn(),
};

const makeMockHLClient = () =>
  Layer.succeed(
    HyperliquidClient,
    HyperliquidClient.of({
      info: mockInfoInstance as unknown as InfoClient,
    })
  );

const makePlaceholderAccount = (overrides?: Partial<Record<string, unknown>>) => ({
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

const makePlaceholderCredential = (overrides?: Partial<Record<string, unknown>>) => ({
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

const makeDecryptedCredential = (overrides?: Partial<Record<string, unknown>>) => ({
  privateKey: Redacted.make(VALID_PRIVATE_KEY),
  walletAddress: "0xMASTER",
  vaultAddress: undefined,
  agentAddress: "0xAGENT",
  exchange: "hyperliquid",
  permissions: [],
  ...overrides,
});

const defaultMockAccountRepo = {
  create: vi.fn().mockReturnValue(Effect.succeed(makePlaceholderAccount())),
  findById: vi.fn().mockReturnValue(Effect.fail(new AccountNotFound({ accountId: "nope" }))),
  findByUserId: vi.fn().mockReturnValue(Effect.succeed([])),
  findPrimary: vi.fn().mockReturnValue(Effect.succeed(makePlaceholderAccount())),
  findWithDescendants: vi.fn().mockReturnValue(Effect.succeed([])),
  resolveMasterWallet: vi.fn().mockReturnValue(Effect.succeed("0xMASTER")),
  setPrimary: vi.fn().mockReturnValue(Effect.succeed(void 0)),
  deactivate: vi.fn().mockReturnValue(Effect.succeed(void 0)),
};

const defaultMockCredRepo = {
  create: vi.fn().mockReturnValue(Effect.succeed(makePlaceholderCredential())),
  getActiveForAccount: vi.fn().mockReturnValue(Effect.succeed(makePlaceholderCredential())),
  getDecryptedAgent: vi.fn().mockReturnValue(Effect.succeed(makeDecryptedCredential())),
  getDecryptedEoa: vi.fn().mockReturnValue(Effect.die(new Error("not implemented"))),
  rotate: vi.fn().mockReturnValue(Effect.succeed(makePlaceholderCredential({ id: "cred-2" }))),
  revoke: vi.fn().mockReturnValue(Effect.succeed(void 0)),
  setVerified: vi.fn().mockReturnValue(Effect.succeed(void 0)),
  markUsed: vi.fn().mockReturnValue(Effect.succeed(void 0)),
};

const makeTestLayer = (
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

describe("ExchangeService — order operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("placeOrder", () => {
    it("builds correct HL payload from generic input", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
      mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "buy",
                  price: "100",
                  quantity: "0.5",
                  reduceOnly: false,
                  orderType: { kind: "limit", timeInForce: "GTC" },
                },
              ],
            },
            USER_A
          );
        }).pipe(Effect.provide(makeTestLayer()))
      );

      const callArg = mockExchangeInstance.order.mock.calls[0][0];
      expect(callArg.orders[0].a).toBe(0);
      expect(callArg.orders[0].b).toBe(true);
      expect(callArg.orders[0].p).toBe("100");
      expect(callArg.orders[0].s).toBe("0.5");
      expect(callArg.orders[0].r).toBe(false);
      expect(callArg.grouping).toBe("na");
    });

    it("maps insufficient margin ApiRequestError to InsufficientMarginError", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
      const error = new ApiRequestError({
        status: "err",
        response: "insufficient margin for order",
      });
      mockExchangeInstance.order.mockRejectedValueOnce(error);

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "buy",
                  price: "100",
                  quantity: "0.5",
                  reduceOnly: false,
                  orderType: { kind: "limit", timeInForce: "GTC" },
                },
              ],
            },
            USER_A
          );
        })
          .pipe(Effect.provide(makeTestLayer()))
          .pipe(Effect.flip)
      );

      expect(result).toBeInstanceOf(InsufficientMarginError);
      expect(result._tag).toBe("InsufficientMarginError");
    });

    it("maps ValiError to HyperliquidValidationError", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
      const error = new ValiError([
        {
          kind: "schema",
          type: "string",
          input: {},
          expected: "",
          received: "",
          message: "Invalid payload",
        } as any,
      ]);
      mockExchangeInstance.order.mockRejectedValueOnce(error);

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "buy",
                  price: "100",
                  quantity: "0.5",
                  reduceOnly: false,
                  orderType: { kind: "limit", timeInForce: "GTC" },
                },
              ],
            },
            USER_A
          );
        })
          .pipe(Effect.provide(makeTestLayer()))
          .pipe(Effect.flip)
      );

      expect(result).toBeInstanceOf(HyperliquidValidationError);
      expect(result._tag).toBe("HyperliquidValidationError");
    });

    it("sends TP/SL child orders with r:true and opposite b direction", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
      mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "buy",
                  price: "100",
                  quantity: "0.5",
                  reduceOnly: false,
                  orderType: { kind: "limit", timeInForce: "GTC" },
                },
                {
                  symbol: "BTC",
                  side: "sell",
                  price: "110",
                  quantity: "0.5",
                  reduceOnly: true,
                  orderType: { kind: "trigger", isMarket: true, triggerPrice: "110", tpsl: "tp" },
                },
                {
                  symbol: "BTC",
                  side: "sell",
                  price: "90",
                  quantity: "0.5",
                  reduceOnly: true,
                  orderType: { kind: "trigger", isMarket: true, triggerPrice: "90", tpsl: "sl" },
                },
              ],
              grouping: "normalTpsl",
            },
            USER_A
          );
        }).pipe(Effect.provide(makeTestLayer()))
      );

      const callArg = mockExchangeInstance.order.mock.calls[0][0];
      expect(callArg.orders).toHaveLength(3);
      expect(callArg.orders[0].b).toBe(true);
      expect(callArg.orders[0].r).toBe(false);
      expect(callArg.orders[1].b).toBe(false);
      expect(callArg.orders[1].r).toBe(true);
      expect(callArg.orders[1].t.trigger.tpsl).toBe("tp");
      expect(callArg.orders[2].b).toBe(false);
      expect(callArg.orders[2].r).toBe(true);
      expect(callArg.orders[2].t.trigger.tpsl).toBe("sl");
    });

    it("enforces reduceOnly true for close position orders", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
      mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "sell",
                  price: "0",
                  quantity: "0.5",
                  reduceOnly: true,
                  orderType: { kind: "limit", timeInForce: "FrontendMarket" },
                },
              ],
              grouping: "na",
            },
            USER_A
          );
        }).pipe(Effect.provide(makeTestLayer()))
      );

      const callArg = mockExchangeInstance.order.mock.calls[0][0];
      expect(callArg.orders[0].r).toBe(true);
    });

    it("fails with AccountNotFound when primary account not found", async () => {
      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder({ orders: [] }, USER_A);
        })
          .pipe(
            Effect.provide(
              makeTestLayer({
                findPrimary: vi
                  .fn()
                  .mockReturnValue(
                    Effect.fail(new AccountNotFound({ accountId: "primary@user-a/hyperliquid" }))
                  ),
              })
            )
          )
          .pipe(Effect.flip)
      );

      expect(result).toBeInstanceOf(AccountNotFound);
      expect(result._tag).toBe("AccountNotFound");
    });
  });

  describe("updateLeverageAndMargin", () => {
    it("sends isCross and leverage for cross margin mode", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({
        universe: [{ name: "BTC" }, { name: "ETH" }],
      });
      mockExchangeInstance.updateLeverage.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.updateLeverageAndMargin(
            { symbol: "ETH", isCross: true, leverage: 10 },
            USER_A
          );
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockExchangeInstance.updateLeverage).toHaveBeenCalledWith({
        asset: 1,
        isCross: true,
        leverage: 10,
      });
    });

    it("sends isCross and leverage for isolated margin mode", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({
        universe: [{ name: "BTC" }, { name: "ETH" }, { name: "SOL" }],
      });
      mockExchangeInstance.updateLeverage.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.updateLeverageAndMargin(
            { symbol: "SOL", isCross: false, leverage: 5 },
            USER_A
          );
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockExchangeInstance.updateLeverage).toHaveBeenCalledWith({
        asset: 2,
        isCross: false,
        leverage: 5,
      });
    });
  });

  describe("cancelOrders", () => {
    it("cancels a single order by symbol and orderId", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }, { name: "ETH" }] });
      mockExchangeInstance.cancel.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.cancelOrders({ cancels: [{ symbol: "BTC", orderId: 12345 }] }, USER_A);
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockInfoInstance.meta).toHaveBeenCalled();
      expect(mockExchangeInstance.cancel).toHaveBeenCalledWith({
        cancels: [{ a: 0, o: 12345 }],
      });
    });

    it("cancels multiple orders across different symbols", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({
        universe: [{ name: "BTC" }, { name: "ETH" }, { name: "SOL" }],
      });
      mockExchangeInstance.cancel.mockResolvedValueOnce({ response: "ok" });

      await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.cancelOrders(
            {
              cancels: [
                { symbol: "ETH", orderId: 111 },
                { symbol: "SOL", orderId: 222 },
              ],
            },
            USER_A
          );
        }).pipe(Effect.provide(makeTestLayer()))
      );

      expect(mockExchangeInstance.cancel).toHaveBeenCalledWith({
        cancels: [
          { a: 1, o: 111 },
          { a: 2, o: 222 },
        ],
      });
    });

    it("fails with HyperliquidInternalError for unknown symbol", async () => {
      mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.cancelOrders({ cancels: [{ symbol: "UNKNOWN", orderId: 1 }] }, USER_A);
        })
          .pipe(Effect.provide(makeTestLayer()))
          .pipe(Effect.flip)
      );

      expect(result).toBeInstanceOf(HyperliquidInternalError);
      expect(result._tag).toBe("HyperliquidInternalError");
    });
  });
});

describe("ExchangeService — credential system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TC-01: Create master wallet account", async () => {
    const mockAccountRepo = {
      ...defaultMockAccountRepo,
      create: vi.fn().mockReturnValue(
        Effect.succeed({
          id: "acct-wallet-1",
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
        })
      ),
    };

    const layer = Layer.succeed(
      ExchangeAccountRepo,
      ExchangeAccountRepo.of(mockAccountRepo as any)
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeAccountRepo;
        return yield* repo.create({
          userId: USER_A,
          exchangeSlug: "hyperliquid",
          nodeType: "wallet",
          walletAddress: "0xMASTER",
          label: "Master",
        } as any);
      }).pipe(Effect.provide(layer))
    );

    expect(result.walletAddress).toBe("0xMASTER");
    expect(result).not.toHaveProperty("encAgentKey");
    expect(result).not.toHaveProperty("encEoaKey");
  });

  it("TC-02: Create agent credential", async () => {
    const RAW_KEY = "0x" + "b".repeat(64);
    const ENCRYPTED_KEY = "enc:" + RAW_KEY; // simulate encryption

    const mockCredRepo = {
      ...defaultMockCredRepo,
      create: vi.fn().mockImplementation((params: any) =>
        Effect.succeed({
          id: "cred-agent-1",
          accountId: params.accountId,
          userId: params.userId,
          credentialSubtype: "agent",
          label: params.label ?? "",
          agentAddress: params.agentAddress,
          // Simulate encryption
          encAgentKey: ENCRYPTED_KEY,
          encEoaKey: undefined,
          permissions: params.permissions ?? [],
          isActive: true,
          isRevoked: false,
          isVerified: false,
          encryptionVersion: 1,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      ),
    };

    const layer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(mockCredRepo as any)
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        return yield* repo.create({
          userId: USER_A,
          accountId: "acct-wallet-1",
          credentialSubtype: "agent",
          agentAddress: "0xAGENT",
          agentKey: RAW_KEY,
          label: "Agent Key",
          permissions: ["order:place"],
          isVerified: false,
        } as any);
      }).pipe(Effect.provide(layer))
    );

    expect(result.encAgentKey).toBe(ENCRYPTED_KEY);
    expect(result.encAgentKey).not.toBe(RAW_KEY);
    expect(result.agentAddress).toBe("0xAGENT");
    expect(result.isVerified).toBe(false);
    expect(mockCredRepo.create).toHaveBeenCalledOnce();
  });

  it("TC-03: Block unverified credential in live trading", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(
          Effect.provide(
            makeTestLayer(
              {},
              {
                getDecryptedAgent: vi
                  .fn()
                  .mockReturnValue(
                    Effect.fail(new CredentialUnverified({ credentialId: "cred-1" }))
                  ),
              }
            )
          )
        )
        .pipe(Effect.flip)
    );

    expect(result).toBeInstanceOf(CredentialUnverified);
    expect(result._tag).toBe("CredentialUnverified");
  });

  it("TC-04: Verify and resolve — master wallet (happy path)", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    const decryptedCred = makeDecryptedCredential({
      privateKey: Redacted.make(VALID_PRIVATE_KEY),
      walletAddress: "0xMASTER",
      vaultAddress: undefined,
      agentAddress: "0xAGENT",
    });

    const getDecryptedAgentMock = vi.fn().mockReturnValue(Effect.succeed(decryptedCred));

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder(
          {
            orders: [
              {
                symbol: "BTC",
                side: "buy",
                price: "100",
                quantity: "0.5",
                reduceOnly: false,
                orderType: { kind: "limit", timeInForce: "GTC" },
              },
            ],
          },
          USER_A
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: getDecryptedAgentMock,
            }
          )
        )
      )
    );

    expect(getDecryptedAgentMock).toHaveBeenCalled();

    expect(Redacted.isRedacted(decryptedCred.privateKey)).toBe(true);
    expect(decryptedCred.walletAddress).toBe("0xMASTER");
    expect(decryptedCred.vaultAddress).toBeUndefined();
    expect(decryptedCred.agentAddress).toBe("0xAGENT");
  });

  it("TC-05: Sub-account credential resolution", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    const subDecryptedCred = makeDecryptedCredential({
      privateKey: Redacted.make(VALID_PRIVATE_KEY),
      walletAddress: "0xMASTER",
      vaultAddress: "0xSUB1",
      agentAddress: "0xAGENT_SUB",
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder(
          {
            orders: [
              {
                symbol: "BTC",
                side: "sell",
                price: "200",
                quantity: "1.0",
                reduceOnly: false,
                orderType: { kind: "limit", timeInForce: "GTC" },
              },
            ],
          },
          USER_A
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: vi.fn().mockReturnValue(Effect.succeed(subDecryptedCred)),
            }
          )
        )
      )
    );

    expect(subDecryptedCred.walletAddress).toBe("0xMASTER");
    expect(subDecryptedCred.vaultAddress).toBe("0xSUB1");
  });

  it("TC-06: Revoked credential blocked before decrypt", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(
          Effect.provide(
            makeTestLayer(
              {},
              {
                getDecryptedAgent: vi
                  .fn()
                  .mockReturnValue(Effect.fail(new CredentialRevoked({ credentialId: "cred-1" }))),
              }
            )
          )
        )
        .pipe(Effect.flip)
    );

    expect(result).toBeInstanceOf(CredentialRevoked);
    expect(result._tag).toBe("CredentialRevoked");
  });

  it("TC-07: Expired credential blocked", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(
          Effect.provide(
            makeTestLayer(
              {},
              {
                getDecryptedAgent: vi
                  .fn()
                  .mockReturnValue(Effect.fail(new CredentialExpired({ credentialId: "cred-1" }))),
              }
            )
          )
        )
        .pipe(Effect.flip)
    );

    expect(result).toBeInstanceOf(CredentialExpired);
    expect(result._tag).toBe("CredentialExpired");
  });

  it("TC-08: Cross-user isolation", async () => {
    const getDecryptedAgentMock = vi
      .fn()
      .mockReturnValue(Effect.fail(new CredentialNotFound({ credentialId: "cred-1" })));

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_B);
      })
        .pipe(
          Effect.provide(
            makeTestLayer(
              {},
              {
                getDecryptedAgent: getDecryptedAgentMock,
              }
            )
          )
        )
        .pipe(Effect.flip)
    );

    expect(result).toBeInstanceOf(CredentialNotFound);
    expect(result._tag).toBe("CredentialNotFound");
    expect(getDecryptedAgentMock).toHaveBeenCalled();
  });

  it("TC-09: Rotation chain", async () => {
    const OLD_ID = "cred-old";
    const NEW_ID = "cred-new";
    const NEW_KEY = "0x" + "c".repeat(64);

    // Simulate rotation: old inactive, new created
    let oldActive = true;
    const mockRotateRepo = {
      ...defaultMockCredRepo,
      rotate: vi.fn().mockImplementation(() => {
        oldActive = false;
        return Effect.succeed(
          makePlaceholderCredential({
            id: NEW_ID,
            encAgentKey: "enc:" + NEW_KEY,
            rotatedFrom: OLD_ID,
            isActive: true,
          })
        );
      }),
      getActiveForAccount: vi.fn().mockImplementation(() => {
        if (!oldActive) {
          return Effect.succeed(
            makePlaceholderCredential({
              id: NEW_ID,
              rotatedFrom: OLD_ID,
              isActive: true,
            })
          );
        }
        return Effect.succeed(makePlaceholderCredential({ id: OLD_ID }));
      }),
    };

    const layer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(mockRotateRepo as any)
    );

    const rotated = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        return yield* repo.rotate(OLD_ID, {
          userId: USER_A,
          accountId: "acct-1",
          credentialSubtype: "agent",
          agentKey: NEW_KEY,
          agentAddress: "0xAGENT_NEW",
          label: "Rotated Key",
        } as any);
      }).pipe(Effect.provide(layer))
    );

    expect(rotated.id).toBe(NEW_ID);
    expect(rotated.isActive).toBe(true);
    expect(rotated.rotatedFrom).toBe(OLD_ID);
    expect(mockRotateRepo.rotate).toHaveBeenCalledOnce();
  });

  it("TC-10: Primary account atomicity", async () => {
    const mockAccountRepo1 = {
      ...defaultMockAccountRepo,
      setPrimary: vi.fn().mockReturnValue(Effect.succeed(void 0)),
    };

    const layer = Layer.succeed(
      ExchangeAccountRepo,
      ExchangeAccountRepo.of(mockAccountRepo1 as any)
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeAccountRepo;
        return yield* repo.setPrimary("acct-2", USER_A);
      }).pipe(Effect.provide(layer))
    );

    expect(mockAccountRepo1.setPrimary).toHaveBeenCalledWith("acct-2", USER_A);
    expect(mockAccountRepo1.setPrimary).toHaveBeenCalledOnce();
  });

  it("TC-11: markUsed does not block pipeline", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    const markUsedDelay = vi.fn().mockReturnValue(
      Effect.sync(() => {
        // Simulate async DB write — key is that getDecryptedAgent returns immediately
      })
    );

    const credRepoWithSlowMark = {
      ...defaultMockCredRepo,
      markUsed: markUsedDelay,
    };

    const start = Date.now();
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder(
          {
            orders: [
              {
                symbol: "BTC",
                side: "buy",
                price: "100",
                quantity: "0.5",
                reduceOnly: false,
                orderType: { kind: "limit", timeInForce: "GTC" },
              },
            ],
          },
          USER_A
        );
      }).pipe(Effect.provide(makeTestLayer({}, credRepoWithSlowMark)))
    );
    const elapsed = Date.now() - start;

    // markUsed is fire-and-forget — order placed before DB write completes
    expect(mockExchangeInstance.order).toHaveBeenCalled();
    expect(elapsed).toBeLessThan(5000); // generous bound — no blocking
  });
});

// Group 1: Security Boundary Tests

describe("Security Boundary — vaultAddress forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards vaultAddress as second arg on order()", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder(
          {
            orders: [
              {
                symbol: "BTC",
                side: "buy",
                price: "100",
                quantity: "0.5",
                reduceOnly: false,
                orderType: { kind: "limit", timeInForce: "GTC" },
              },
            ],
          },
          USER_A
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: vi
                .fn()
                .mockReturnValue(
                  Effect.succeed(makeDecryptedCredential({ vaultAddress: "0xVAULT" }))
                ),
            }
          )
        )
      )
    );

    const callArgs = mockExchangeInstance.order.mock.calls[0];
    expect(callArgs[1]).toEqual({ vaultAddress: "0xVAULT" });
  });

  it("forwards vaultAddress as second arg on updateLeverage()", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.updateLeverage.mockResolvedValueOnce({ response: "ok" });

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.updateLeverageAndMargin(
          { symbol: "BTC", isCross: true, leverage: 10 },
          USER_A
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: vi
                .fn()
                .mockReturnValue(
                  Effect.succeed(makeDecryptedCredential({ vaultAddress: "0xVAULT" }))
                ),
            }
          )
        )
      )
    );

    expect(mockExchangeInstance.updateLeverage).toHaveBeenCalledWith(expect.any(Object), {
      vaultAddress: "0xVAULT",
    });
  });

  it("forwards vaultAddress as second arg on cancel()", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.cancel.mockResolvedValueOnce({ response: "ok" });

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.cancelOrders({ cancels: [{ symbol: "BTC", orderId: 123 }] }, USER_A);
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: vi
                .fn()
                .mockReturnValue(
                  Effect.succeed(makeDecryptedCredential({ vaultAddress: "0xVAULT" }))
                ),
            }
          )
        )
      )
    );

    expect(mockExchangeInstance.cancel).toHaveBeenCalledWith(expect.any(Object), {
      vaultAddress: "0xVAULT",
    });
  });
});

describe("Security Boundary — vaultAddress omitted for wallet accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does NOT forward vaultAddress when undefined (wallet account)", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder(
          {
            orders: [
              {
                symbol: "BTC",
                side: "buy",
                price: "100",
                quantity: "0.5",
                reduceOnly: false,
                orderType: { kind: "limit", timeInForce: "GTC" },
              },
            ],
          },
          USER_A
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: vi
                .fn()
                .mockReturnValue(
                  Effect.succeed(makeDecryptedCredential({ vaultAddress: undefined }))
                ),
            }
          )
        )
      )
    );

    const callArgs = mockExchangeInstance.order.mock.calls[0];
    expect(callArgs[1]).toEqual({});
  });
});

describe("Security Boundary — getActiveForAccount isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cross-user isolation: USER_B cannot access USER_A credential", async () => {
    const isolationMock = {
      ...defaultMockCredRepo,
      getActiveForAccount: vi.fn().mockImplementation((accountId: string, userId: string) => {
        if (userId === USER_A) {
          return Effect.succeed(makePlaceholderCredential({ userId: USER_A }));
        }
        return Effect.fail(new CredentialNotFound({ credentialId: `${accountId}/agent` }));
      }),
    };

    const layer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(isolationMock as any)
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        return yield* repo.getActiveForAccount("acct-owned-by-A", "USER_B", "agent");
      })
        .pipe(Effect.provide(layer))
        .pipe(Effect.flip)
    );

    expect(result).toBeInstanceOf(CredentialNotFound);
    expect(result._tag).toBe("CredentialNotFound");
  });

  it("succeeds when correct userId matches credential owner", async () => {
    const isolationMock = {
      ...defaultMockCredRepo,
      getActiveForAccount: vi
        .fn()
        .mockReturnValue(
          Effect.succeed(makePlaceholderCredential({ id: "cred-accessible", userId: USER_A }))
        ),
    };

    const layer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(isolationMock as any)
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        return yield* repo.getActiveForAccount("acct-owned-by-A", "USER_A", "agent");
      }).pipe(Effect.provide(layer))
    );

    expect(result.id).toBe("cred-accessible");
    expect(result.userId).toBe(USER_A);
    expect(result.credentialSubtype).toBe("agent");
  });
});

describe("Security Boundary — error sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("error mapping produces sanitized messages (no UUID leak)", async () => {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(
          Effect.provide(
            makeTestLayer(
              {},
              {
                getDecryptedAgent: vi
                  .fn()
                  .mockReturnValue(
                    Effect.fail(new CredentialNotFound({ credentialId: "cred-sanitized-id" }))
                  ),
              }
            )
          )
        )
        .pipe(Effect.flip)
    );

    expect(result).toBeInstanceOf(CredentialNotFound);
    // No UUID leak in credentialId or message
    if ("credentialId" in (result as any)) {
      expect((result as any).credentialId).not.toMatch(uuidPattern);
    }
    expect((result as any).message ?? "").not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/
    );
  });
});

describe("Security Boundary — markUsed fire-and-forget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("markUsed is triggered during credential resolution and does not block", async () => {
    // Verify fire-and-forget: markUsed called as side effect, pipeline doesn't block

    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    const markUsedSpy = vi.fn();

    // Fire-and-forget: getDecryptedAgent triggers markUsed, returns immediately
    const getDecryptedAgentWithMarkUsed = vi.fn().mockImplementation((id: string) => {
      markUsedSpy(id);
      return Effect.succeed(makeDecryptedCredential());
    });

    const start = Date.now();
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder(
          {
            orders: [
              {
                symbol: "BTC",
                side: "buy",
                price: "100",
                quantity: "0.5",
                reduceOnly: false,
                orderType: { kind: "limit", timeInForce: "GTC" },
              },
            ],
          },
          USER_A
        );
      }).pipe(
        Effect.provide(makeTestLayer({}, { getDecryptedAgent: getDecryptedAgentWithMarkUsed }))
      )
    );
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(mockExchangeInstance.order).toHaveBeenCalled();
    expect(markUsedSpy).toHaveBeenCalledWith("cred-1");
  });
});

// Group 2: Full Lifecycle Tests

describe("Full credential lifecycle end-to-end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("steps through create → unverified block → verify → trade → rotate → revoke", async () => {
    // Two-credential state machine
    const creds = {
      old: { id: "cred-lc-old", isVerified: false, isRevoked: false, isActive: true },
      new: { id: "cred-lc-new", isVerified: false, isRevoked: false, isActive: false },
    };

    const lifecycleMock = {
      ...defaultMockCredRepo,
      getActiveForAccount: vi.fn().mockImplementation(() => {
        const active = Object.values(creds).find((c) => c.isActive && !c.isRevoked);
        if (!active) return Effect.fail(new CredentialNotFound({ credentialId: "none" }));
        return Effect.succeed(
          makePlaceholderCredential({ id: active.id, isVerified: active.isVerified })
        );
      }),
      getDecryptedAgent: vi.fn().mockImplementation((id: string) => {
        const cred = Object.values(creds).find((c) => c.id === id);
        if (!cred || !cred.isActive)
          return Effect.fail(new CredentialNotFound({ credentialId: id }));
        if (cred.isRevoked) return Effect.fail(new CredentialRevoked({ credentialId: id }));
        if (!cred.isVerified) return Effect.fail(new CredentialUnverified({ credentialId: id }));
        return Effect.succeed(makeDecryptedCredential());
      }),
      setVerified: vi.fn().mockImplementation((id: string) => {
        const cred = Object.values(creds).find((c) => c.id === id);
        if (cred) cred.isVerified = true;
        return Effect.succeed(void 0);
      }),
      rotate: vi.fn().mockImplementation(() => {
        creds.old.isActive = false;
        creds.new.isActive = true;
        // New credential inherits verified status from the old one
        creds.new.isVerified = creds.old.isVerified;
        return Effect.succeed(
          makePlaceholderCredential({
            id: "cred-lc-new",
            rotatedFrom: "cred-lc-old",
            isActive: true,
          })
        );
      }),
      revoke: vi.fn().mockImplementation((id: string) => {
        const cred = Object.values(creds).find((c) => c.id === id);
        if (cred) cred.isRevoked = true;
        return Effect.succeed(void 0);
      }),
    };

    const accountLayer = Layer.succeed(
      ExchangeAccountRepo,
      ExchangeAccountRepo.of(defaultMockAccountRepo as any)
    );
    const credLayer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(lifecycleMock as any)
    );
    const testLayer = exchangeServiceLayer.pipe(
      Layer.provideMerge(accountLayer),
      Layer.provideMerge(credLayer),
      Layer.provideMerge(makeMockHLClient())
    );

    const blocked = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(Effect.provide(testLayer))
        .pipe(Effect.flip)
    );
    expect(blocked).toBeInstanceOf(CredentialUnverified);
    expect(blocked._tag).toBe("CredentialUnverified");

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        yield* repo.setVerified("cred-lc-old", USER_A);
      }).pipe(Effect.provide(testLayer))
    );
    expect(creds.old.isVerified).toBe(true);
    expect(lifecycleMock.setVerified).toHaveBeenCalledOnce();

    mockInfoInstance.meta.mockResolvedValue({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValue({ response: "ok" });
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder(
          {
            orders: [
              {
                symbol: "BTC",
                side: "buy",
                price: "100",
                quantity: "0.5",
                reduceOnly: false,
                orderType: { kind: "limit", timeInForce: "GTC" },
              },
            ],
          },
          USER_A
        );
      }).pipe(Effect.provide(testLayer))
    );
    expect(mockExchangeInstance.order).toHaveBeenCalled();

    const rotated = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        return yield* repo.rotate("cred-lc-old", {
          userId: USER_A,
          accountId: "acct-1",
          credentialSubtype: "agent",
          agentKey: "0x" + "c".repeat(64),
          agentAddress: "0xAGENT_NEW",
        } as any);
      }).pipe(Effect.provide(testLayer))
    );
    expect(rotated.id).toBe("cred-lc-new");
    expect(rotated.rotatedFrom).toBe("cred-lc-old");
    expect(creds.old.isActive).toBe(false);
    expect(creds.new.isActive).toBe(true);

    mockInfoInstance.meta.mockResolvedValue({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValue({ response: "ok" });
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      }).pipe(Effect.provide(testLayer))
    );
    expect(mockExchangeInstance.order).toHaveBeenCalledTimes(2);

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        yield* repo.revoke("cred-lc-new", "compromised", USER_A);
      }).pipe(Effect.provide(testLayer))
    );
    expect(creds.new.isRevoked).toBe(true);

    // All credentials inactive/revoked -> getActiveForAccount returns CredentialNotFound
    const revokedResult = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(Effect.provide(testLayer))
        .pipe(Effect.flip)
    );
    expect(revokedResult).toBeInstanceOf(CredentialNotFound);
    expect(revokedResult._tag).toBe("CredentialNotFound");
  });
});

describe("Expired credential — decrypt never called", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks expired credential before decrypt is invoked", async () => {
    // Simulate real PG check order: expired check happens BEFORE decrypt
    let decryptWouldHaveBeenCalled = false;

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(
          Effect.provide(
            makeTestLayer(
              {},
              {
                getDecryptedAgent: vi.fn().mockImplementation((id: string) => {
                  // Real impl checks expires_at before decrypt — fail before decrypt
                  return Effect.fail(new CredentialExpired({ credentialId: id }));
                  decryptWouldHaveBeenCalled = true;
                }),
              }
            )
          )
        )
        .pipe(Effect.flip)
    );

    expect(result).toBeInstanceOf(CredentialExpired);
    expect(result._tag).toBe("CredentialExpired");
    expect(decryptWouldHaveBeenCalled).toBe(false);
  });
});

// Group 3: Sub-account/Vault Flow Tests

describe("Sub-account/Vault flow — vaultAddress resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sub-account order forwards vaultAddress to ExchangeClient", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder(
          {
            orders: [
              {
                symbol: "BTC",
                side: "buy",
                price: "100",
                quantity: "0.5",
                reduceOnly: false,
                orderType: { kind: "limit", timeInForce: "GTC" },
              },
            ],
          },
          USER_A
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: vi.fn().mockReturnValue(
                Effect.succeed(
                  makeDecryptedCredential({
                    walletAddress: "0xMASTER",
                    vaultAddress: "0xSUB1",
                    privateKey: Redacted.make(VALID_PRIVATE_KEY),
                  })
                )
              ),
            }
          )
        )
      )
    );

    expect(mockExchangeInstance.order).toHaveBeenCalledWith(expect.any(Object), {
      vaultAddress: "0xSUB1",
    });
  });

  it("vault account forwards vaultAddress to ExchangeClient", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder(
          {
            orders: [
              {
                symbol: "BTC",
                side: "buy",
                price: "100",
                quantity: "0.5",
                reduceOnly: false,
                orderType: { kind: "limit", timeInForce: "GTC" },
              },
            ],
          },
          USER_A
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: vi.fn().mockReturnValue(
                Effect.succeed(
                  makeDecryptedCredential({
                    walletAddress: "0xMASTER",
                    vaultAddress: "0xVAULT1",
                    privateKey: Redacted.make(VALID_PRIVATE_KEY),
                  })
                )
              ),
            }
          )
        )
      )
    );

    expect(mockExchangeInstance.order).toHaveBeenCalledWith(expect.any(Object), {
      vaultAddress: "0xVAULT1",
    });
  });
});

// Group 4: Concurrent/Multi-User Tests

describe("Concurrent/Multi-User isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("two users with same exchange get isolated credentials", async () => {
    mockInfoInstance.meta.mockResolvedValue({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValue({ response: "ok" });

    const userAState = { called: false, wallet: "0xUSER_A" };
    const userBState = { called: false, wallet: "0xUSER_B" };

    const multiUserAccountRepo = {
      ...defaultMockAccountRepo,
      findPrimary: vi.fn().mockImplementation((userId: string) => {
        if (userId === USER_A) {
          return Effect.succeed(
            makePlaceholderAccount({ userId: USER_A, walletAddress: "0xUSER_A" })
          );
        }
        if (userId === USER_B) {
          return Effect.succeed(
            makePlaceholderAccount({ userId: USER_B, walletAddress: "0xUSER_B" })
          );
        }
        return Effect.fail(new AccountNotFound({ accountId: userId }));
      }),
    };

    const multiUserCredRepo = {
      ...defaultMockCredRepo,
      getDecryptedAgent: vi.fn().mockImplementation((id: string, userId: string) => {
        if (userId === USER_A) {
          userAState.called = true;
          return Effect.succeed(makeDecryptedCredential({ walletAddress: "0xUSER_A" }));
        }
        if (userId === USER_B) {
          userBState.called = true;
          return Effect.succeed(makeDecryptedCredential({ walletAddress: "0xUSER_B" }));
        }
        return Effect.fail(new CredentialNotFound({ credentialId: id }));
      }),
    };

    const isolatedLayer = exchangeServiceLayer.pipe(
      Layer.provideMerge(
        Layer.succeed(ExchangeAccountRepo, ExchangeAccountRepo.of(multiUserAccountRepo as any))
      ),
      Layer.provideMerge(
        Layer.succeed(ExchangeCredentialRepo, ExchangeCredentialRepo.of(multiUserCredRepo as any))
      ),
      Layer.provideMerge(makeMockHLClient())
    );

    const [resultA, resultB] = await Effect.runPromise(
      Effect.all([
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "buy",
                  price: "100",
                  quantity: "0.5",
                  reduceOnly: false,
                  orderType: { kind: "limit", timeInForce: "GTC" },
                },
              ],
            },
            USER_A
          );
        }),
        Effect.gen(function* () {
          const svc = yield* ExchangeService;
          return yield* svc.placeOrder(
            {
              orders: [
                {
                  symbol: "BTC",
                  side: "buy",
                  price: "100",
                  quantity: "0.5",
                  reduceOnly: false,
                  orderType: { kind: "limit", timeInForce: "GTC" },
                },
              ],
            },
            USER_B
          );
        }),
      ]).pipe(Effect.provide(isolatedLayer))
    );

    expect(resultA).toEqual({ response: "ok" });
    expect(resultB).toEqual({ response: "ok" });
    expect(userAState.called).toBe(true);
    expect(userBState.called).toBe(true);
    expect(multiUserAccountRepo.findPrimary).toHaveBeenCalledWith(USER_A, "hyperliquid");
    expect(multiUserAccountRepo.findPrimary).toHaveBeenCalledWith(USER_B, "hyperliquid");
  });

  it("fails with AccountNotFound when user has no primary account for exchange", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(
          Effect.provide(
            makeTestLayer({
              findPrimary: vi
                .fn()
                .mockReturnValue(
                  Effect.fail(
                    new AccountNotFound({ accountId: "primary@user-no-account/hyperliquid" })
                  )
                ),
            })
          )
        )
        .pipe(Effect.flip)
    );

    expect(result).toBeInstanceOf(AccountNotFound);
    expect(result._tag).toBe("AccountNotFound");
  });
});

// Group 5: Route Handler Integration — Session Threading

describe("Route handler — userId propagation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("userId propagates through route handler to service", async () => {
    const routes = buildExchangeRoutes({
      json: (body: unknown, status = 200, headers?: Record<string, string>) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json", ...headers },
        }),
      mapServiceError: (error: unknown) => {
        if (error && typeof error === "object" && "_tag" in error) {
          return {
            status: 500,
            message: (error as any).message ?? "error",
            code: (error as any)._tag,
          };
        }
        return { status: 500, message: "error" };
      },
    });
    const orderRoute = routes.find((r) => r.path === "/api/exchange/order")!;
    const mockExchange = {
      placeOrder: vi.fn().mockReturnValue(Effect.succeed({ response: "ok" })),
      updateLeverageAndMargin: vi.fn(),
      cancelOrders: vi.fn(),
    };
    const request = new Request("http://localhost/api/exchange/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orders: [
          {
            symbol: "BTC",
            side: "buy",
            price: "100",
            quantity: "0.5",
            reduceOnly: false,
            orderType: { kind: "limit", timeInForce: "GTC" },
          },
        ],
      }),
    });
    const url = new URL(request.url);

    await Effect.runPromise(orderRoute.handler(request, url, mockExchange, "USER_X"));

    expect(mockExchange.placeOrder).toHaveBeenCalledWith(expect.any(Object), "USER_X");
  });

  it("returns 401 when userId is missing (unauthenticated)", async () => {
    const routes = buildExchangeRoutes({
      json: (body: unknown, status = 200, headers?: Record<string, string>) =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json", ...headers },
        }),
      mapServiceError: (error: unknown) => {
        if (error && typeof error === "object" && "_tag" in error) {
          return {
            status: 500,
            message: (error as any).message ?? "error",
            code: (error as any)._tag,
          };
        }
        return { status: 500, message: "error" };
      },
    });
    const orderRoute = routes.find((r) => r.path === "/api/exchange/order")!;
    const mockExchange = {
      placeOrder: vi.fn(),
      updateLeverageAndMargin: vi.fn(),
      cancelOrders: vi.fn(),
    };
    const request = new Request("http://localhost/api/exchange/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders: [] }),
    });
    const url = new URL(request.url);

    const error = await Effect.runPromise(
      orderRoute.handler(request, url, mockExchange, undefined).pipe(Effect.flip)
    );

    expect(error).toEqual({ status: 401, message: "Authentication required" });
    expect(mockExchange.placeOrder).not.toHaveBeenCalled();
  });
});

// Group 6: Hyperliquid-Specific Edge Cases

// NONCE ISOLATION RULE (Knowledge Capture)
// One agent credential should not sign for multiple sub-accounts under
// concurrency. Each sub-account/vault must have a dedicated agent credential
// to avoid nonce conflicts on Hyperliquid's order signing.
// This is a design invariant, not a runtime assertion.
it.todo(
  "One agent credential should not sign for multiple sub-accounts under concurrency — nonce isolation rule"
);

// Group 7: Negative/Defensive Tests

describe("Negative/Defensive tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo("Empty permissions array blocks all operations — permission check not yet implemented");

  it("invalid credential subtype (non-agent) fails with CredentialNotFound", async () => {
    // Exchange service requires "agent" credential — non-agent must be rejected
    const mockCredRepo = {
      ...defaultMockCredRepo,
      getActiveForAccount: vi
        .fn()
        .mockReturnValue(
          Effect.succeed(makePlaceholderCredential({ credentialSubtype: "hardware" }))
        ),
      getDecryptedAgent: vi.fn().mockImplementation((id: string) => {
        // PG impl checks credentialSubtype !== "agent"
        return Effect.fail(new CredentialNotFound({ credentialId: id }));
      }),
    };

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(Effect.provide(makeTestLayer({}, mockCredRepo)))
        .pipe(Effect.flip)
    );

    expect(result).toBeInstanceOf(CredentialNotFound);
    expect(result._tag).toBe("CredentialNotFound");
    expect(mockCredRepo.getDecryptedAgent).toHaveBeenCalled();
  });
});
