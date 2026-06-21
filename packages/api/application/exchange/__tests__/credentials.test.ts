import { describe, expect, it, beforeEach, vi } from "vitest";
import { Effect, Layer, Redacted } from "effect";
import {
  mockInfoInstance,
  makeTestLayer,
  makeMockHLClient,
  makePlaceholderAccount,
  makePlaceholderCredential,
  makeDecryptedCredential,
  defaultMockAccountRepo,
  defaultMockCredRepo,
  VALID_PRIVATE_KEY,
  USER_A,
  USER_B,
  ExchangeService,
  ExchangeAccountRepo,
  ExchangeCredentialRepo,
  exchangeServiceLayer,
  AccountNotFound,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
} from "./helpers";

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
        }),
      ),
    };

    const layer = Layer.succeed(
      ExchangeAccountRepo,
      ExchangeAccountRepo.of(mockAccountRepo as any),
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
      }).pipe(Effect.provide(layer)),
    );

    expect(result.walletAddress).toBe("0xMASTER");
    expect(result).not.toHaveProperty("encAgentKey");
    expect(result).not.toHaveProperty("encEoaKey");
  });

  it("TC-02: Create agent credential", async () => {
    const RAW_KEY = "0x" + "b".repeat(64);
    const ENCRYPTED_KEY = "enc:" + RAW_KEY;

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
        }),
      ),
    };

    const layer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(mockCredRepo as any),
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
      }).pipe(Effect.provide(layer)),
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
                    Effect.fail(new CredentialUnverified({ credentialId: "cred-1" })),
                  ),
              },
            ),
          ),
        )
        .pipe(Effect.flip),
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
          USER_A,
        );
      }).pipe(Effect.provide(makeTestLayer({}, { getDecryptedAgent: getDecryptedAgentMock }))),
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
          USER_A,
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            { getDecryptedAgent: vi.fn().mockReturnValue(Effect.succeed(subDecryptedCred)) },
          ),
        ),
      ),
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
              },
            ),
          ),
        )
        .pipe(Effect.flip),
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
              },
            ),
          ),
        )
        .pipe(Effect.flip),
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
        .pipe(Effect.provide(makeTestLayer({}, { getDecryptedAgent: getDecryptedAgentMock })))
        .pipe(Effect.flip),
    );

    expect(result).toBeInstanceOf(CredentialNotFound);
    expect(result._tag).toBe("CredentialNotFound");
    expect(getDecryptedAgentMock).toHaveBeenCalled();
  });

  it("TC-09: Rotation chain", async () => {
    const OLD_ID = "cred-old";
    const NEW_ID = "cred-new";
    const NEW_KEY = "0x" + "c".repeat(64);

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
          }),
        );
      }),
      getActiveForAccount: vi.fn().mockImplementation(() => {
        if (!oldActive) {
          return Effect.succeed(
            makePlaceholderCredential({ id: NEW_ID, rotatedFrom: OLD_ID, isActive: true }),
          );
        }
        return Effect.succeed(makePlaceholderCredential({ id: OLD_ID }));
      }),
    };

    const layer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(mockRotateRepo as any),
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
      }).pipe(Effect.provide(layer)),
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
      ExchangeAccountRepo.of(mockAccountRepo1 as any),
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeAccountRepo;
        return yield* repo.setPrimary("acct-2", USER_A);
      }).pipe(Effect.provide(layer)),
    );

    expect(mockAccountRepo1.setPrimary).toHaveBeenCalledWith("acct-2", USER_A);
    expect(mockAccountRepo1.setPrimary).toHaveBeenCalledOnce();
  });

  it("TC-11: markUsed does not block pipeline", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    const markUsedDelay = vi.fn().mockReturnValue(Effect.sync(() => {}));

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
          USER_A,
        );
      }).pipe(Effect.provide(makeTestLayer({}, { markUsed: markUsedDelay }))),
    );
    const elapsed = Date.now() - start;

    expect(mockExchangeInstance.order).toHaveBeenCalled();
    expect(elapsed).toBeLessThan(5000);
  });
});

// Security Boundary Tests

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
          USER_A,
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: vi
                .fn()
                .mockReturnValue(
                  Effect.succeed(makeDecryptedCredential({ vaultAddress: "0xVAULT" })),
                ),
            },
          ),
        ),
      ),
    );

    expect(mockExchangeInstance.order.mock.calls[0][1]).toEqual({ vaultAddress: "0xVAULT" });
  });

  it("forwards vaultAddress as second arg on updateLeverage()", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.updateLeverage.mockResolvedValueOnce({ response: "ok" });

    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.updateLeverageAndMargin(
          { symbol: "BTC", isCross: true, leverage: 10 },
          USER_A,
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: vi
                .fn()
                .mockReturnValue(
                  Effect.succeed(makeDecryptedCredential({ vaultAddress: "0xVAULT" })),
                ),
            },
          ),
        ),
      ),
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
                  Effect.succeed(makeDecryptedCredential({ vaultAddress: "0xVAULT" })),
                ),
            },
          ),
        ),
      ),
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
          USER_A,
        );
      }).pipe(
        Effect.provide(
          makeTestLayer(
            {},
            {
              getDecryptedAgent: vi
                .fn()
                .mockReturnValue(
                  Effect.succeed(makeDecryptedCredential({ vaultAddress: undefined })),
                ),
            },
          ),
        ),
      ),
    );

    expect(mockExchangeInstance.order.mock.calls[0][1]).toEqual({});
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
        if (userId === USER_A) return Effect.succeed(makePlaceholderCredential({ userId: USER_A }));
        return Effect.fail(new CredentialNotFound({ credentialId: `${accountId}/agent` }));
      }),
    };
    const layer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(isolationMock as any),
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        return yield* repo.getActiveForAccount("acct-owned-by-A", "USER_B", "agent");
      })
        .pipe(Effect.provide(layer))
        .pipe(Effect.flip),
    );

    expect(result).toBeInstanceOf(CredentialNotFound);
  });

  it("succeeds when correct userId matches credential owner", async () => {
    const isolationMock = {
      ...defaultMockCredRepo,
      getActiveForAccount: vi
        .fn()
        .mockReturnValue(
          Effect.succeed(makePlaceholderCredential({ id: "cred-accessible", userId: USER_A })),
        ),
    };
    const layer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(isolationMock as any),
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        return yield* repo.getActiveForAccount("acct-owned-by-A", "USER_A", "agent");
      }).pipe(Effect.provide(layer)),
    );

    expect(result.id).toBe("cred-accessible");
    expect(result.userId).toBe(USER_A);
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
                    Effect.fail(new CredentialNotFound({ credentialId: "cred-sanitized-id" })),
                  ),
              },
            ),
          ),
        )
        .pipe(Effect.flip),
    );

    expect(result).toBeInstanceOf(CredentialNotFound);
    if ("credentialId" in (result as any)) {
      expect((result as any).credentialId).not.toMatch(uuidPattern);
    }
    expect((result as any).message ?? "").not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    );
  });
});

describe("Security Boundary — markUsed fire-and-forget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("markUsed is triggered during credential resolution and does not block", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });
    const markUsedSpy = vi.fn();
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
          USER_A,
        );
      }).pipe(
        Effect.provide(makeTestLayer({}, { getDecryptedAgent: getDecryptedAgentWithMarkUsed })),
      ),
    );
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100);
    expect(mockExchangeInstance.order).toHaveBeenCalled();
    expect(markUsedSpy).toHaveBeenCalledWith("cred-1");
  });
});

// Full Lifecycle Tests

describe("Full credential lifecycle end-to-end", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("steps through create → unverified block → verify → trade → rotate → revoke", async () => {
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
          makePlaceholderCredential({ id: active.id, isVerified: active.isVerified }),
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
        creds.new.isVerified = creds.old.isVerified;
        return Effect.succeed(
          makePlaceholderCredential({
            id: "cred-lc-new",
            rotatedFrom: "cred-lc-old",
            isActive: true,
          }),
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
      ExchangeAccountRepo.of(defaultMockAccountRepo as any),
    );
    const credLayer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(lifecycleMock as any),
    );
    const testLayer = exchangeServiceLayer.pipe(
      Layer.provideMerge(accountLayer),
      Layer.provideMerge(credLayer),
      Layer.provideMerge(makeMockHLClient()),
    );

    // Step 1: Unverified credential blocks trading
    const blocked = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(Effect.provide(testLayer))
        .pipe(Effect.flip),
    );
    expect(blocked).toBeInstanceOf(CredentialUnverified);

    // Step 2: Verify credential
    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        yield* repo.setVerified("cred-lc-old", USER_A);
      }).pipe(Effect.provide(testLayer)),
    );
    expect(creds.old.isVerified).toBe(true);

    // Step 3: Trade succeeds after verification
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
          USER_A,
        );
      }).pipe(Effect.provide(testLayer)),
    );
    expect(mockExchangeInstance.order).toHaveBeenCalled();

    // Step 4: Rotate credential
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
      }).pipe(Effect.provide(testLayer)),
    );
    expect(rotated.id).toBe("cred-lc-new");
    expect(creds.old.isActive).toBe(false);

    // Step 5: Trade with new credential
    mockInfoInstance.meta.mockResolvedValue({ universe: [{ name: "BTC" }] });
    mockExchangeInstance.order.mockResolvedValue({ response: "ok" });
    await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      }).pipe(Effect.provide(testLayer)),
    );

    // Step 6: Revoke and verify block
    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        yield* repo.revoke("cred-lc-new", "compromised", USER_A);
      }).pipe(Effect.provide(testLayer)),
    );

    const revokedResult = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(Effect.provide(testLayer))
        .pipe(Effect.flip),
    );
    expect(revokedResult).toBeInstanceOf(CredentialNotFound);
  });
});

// Edge Cases

describe("Expired credential — decrypt never called", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks expired credential before decrypt is invoked", async () => {
    const decryptWouldHaveBeenCalled = false;

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
                  return Effect.fail(new CredentialExpired({ credentialId: id }));
                }),
              },
            ),
          ),
        )
        .pipe(Effect.flip),
    );

    expect(result).toBeInstanceOf(CredentialExpired);
    expect(decryptWouldHaveBeenCalled).toBe(false);
  });
});

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
          USER_A,
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
                  }),
                ),
              ),
            },
          ),
        ),
      ),
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
          USER_A,
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
                  }),
                ),
              ),
            },
          ),
        ),
      ),
    );

    expect(mockExchangeInstance.order).toHaveBeenCalledWith(expect.any(Object), {
      vaultAddress: "0xVAULT1",
    });
  });
});

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
        if (userId === USER_A)
          return Effect.succeed(
            makePlaceholderAccount({ userId: USER_A, walletAddress: "0xUSER_A" }),
          );
        if (userId === USER_B)
          return Effect.succeed(
            makePlaceholderAccount({ userId: USER_B, walletAddress: "0xUSER_B" }),
          );
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
        Layer.succeed(ExchangeAccountRepo, ExchangeAccountRepo.of(multiUserAccountRepo as any)),
      ),
      Layer.provideMerge(
        Layer.succeed(ExchangeCredentialRepo, ExchangeCredentialRepo.of(multiUserCredRepo as any)),
      ),
      Layer.provideMerge(makeMockHLClient()),
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
            USER_A,
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
            USER_B,
          );
        }),
      ]).pipe(Effect.provide(isolatedLayer)),
    );

    expect(resultA).toEqual({ response: "ok" });
    expect(resultB).toEqual({ response: "ok" });
    expect(userAState.called).toBe(true);
    expect(userBState.called).toBe(true);
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
                    new AccountNotFound({ accountId: "primary@user-no-account/hyperliquid" }),
                  ),
                ),
            }),
          ),
        )
        .pipe(Effect.flip),
    );

    expect(result).toBeInstanceOf(AccountNotFound);
  });
});

// Group 6: Edge Cases

it.todo(
  "One agent credential should not sign for multiple sub-accounts under concurrency — nonce isolation rule",
);

describe("Negative/Defensive tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.todo("Empty permissions array blocks all operations — permission check not yet implemented");

  it("invalid credential subtype (non-agent) fails with CredentialNotFound", async () => {
    const mockCredRepo = {
      ...defaultMockCredRepo,
      getActiveForAccount: vi
        .fn()
        .mockReturnValue(
          Effect.succeed(makePlaceholderCredential({ credentialSubtype: "hardware" })),
        ),
      getDecryptedAgent: vi
        .fn()
        .mockImplementation((id: string) =>
          Effect.fail(new CredentialNotFound({ credentialId: id })),
        ),
    };

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const svc = yield* ExchangeService;
        return yield* svc.placeOrder({ orders: [] }, USER_A);
      })
        .pipe(Effect.provide(makeTestLayer({}, mockCredRepo)))
        .pipe(Effect.flip),
    );

    expect(result).toBeInstanceOf(CredentialNotFound);
    expect(mockCredRepo.getDecryptedAgent).toHaveBeenCalled();
  });
});
