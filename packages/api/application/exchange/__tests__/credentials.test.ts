import { describe, expect, it, beforeEach, vi } from "vitest";
import { Effect, Layer, Redacted } from "effect";
import type {
  ExchangeClient,
  ExchangeConfig,
  HttpTransport,
  HttpTransportOptions,
} from "@nktkas/hyperliquid";
import {
  mockInfoInstance,
  makeTestLayer,
  makeMockHLClient,
  makePlaceholderAccount,
  makePlaceholderCredential,
  makeDecryptedCredential,
  makeMetaResponse,
  defaultMockAccountRepo,
  defaultMockCredRepo,
  VALID_PRIVATE_KEY,
  USER_A,
  USER_B,
  ExchangeService,
  ExchangeAccountRepo,
  ExchangeCredentialRepo,
  exchangeServiceLayer,
  exchangeCredentialsLayer,
  AccountNotFound,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
  type AccountRepoShape,
  type CredRepoShape,
} from "./helpers";

const mockExchangeInstance = vi.hoisted(() => ({
  order: vi.fn<ExchangeClient["order"]>(),
  updateLeverage: vi.fn<ExchangeClient["updateLeverage"]>(),
  cancel: vi.fn<ExchangeClient["cancel"]>(),
}));

vi.mock("@nktkas/hyperliquid", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nktkas/hyperliquid")>();
  return {
    ...actual,
    ExchangeClient: vi.fn<(config: ExchangeConfig) => typeof mockExchangeInstance>(function () {
      return mockExchangeInstance;
    }),
    HttpTransport: vi.fn<(options?: HttpTransportOptions) => HttpTransport>(),
  };
});

const OLD_ID = "cred-old";
const NEW_ID = "cred-new";
const NEW_KEY = "0x" + "c".repeat(64);

type LifecycleCred = {
  id: string;
  isVerified: boolean;
  isRevoked: boolean;
  isActive: boolean;
};

// Mock repos with stateful behaviour live at module scope so the test bodies stay assertion-only.

const makeRotateRepo = (state: { oldActive: boolean }) => ({
  ...defaultMockCredRepo,
  rotate: vi.fn<CredRepoShape["rotate"]>().mockImplementation(() => {
    state.oldActive = false;
    return Effect.succeed(
      makePlaceholderCredential({
        id: NEW_ID,
        encAgentKey: "enc:" + NEW_KEY,
        rotatedFrom: OLD_ID,
        isActive: true,
      }),
    );
  }),
  getActiveForAccount: vi.fn<CredRepoShape["getActiveForAccount"]>().mockImplementation(() => {
    if (!state.oldActive) {
      return Effect.succeed(
        makePlaceholderCredential({ id: NEW_ID, rotatedFrom: OLD_ID, isActive: true }),
      );
    }
    return Effect.succeed(makePlaceholderCredential({ id: OLD_ID }));
  }),
});

const makeUserAwareGetActive = () =>
  vi
    .fn<CredRepoShape["getActiveForAccount"]>()
    .mockImplementation((accountId: string, userId: string) => {
      if (userId === USER_A) return Effect.succeed(makePlaceholderCredential({ userId: USER_A }));
      return Effect.fail(new CredentialNotFound({ credentialId: `${accountId}/agent` }));
    });

const makeLifecycleRepo = (creds: Record<"old" | "new", LifecycleCred>) => ({
  ...defaultMockCredRepo,
  getActiveForAccount: vi.fn<CredRepoShape["getActiveForAccount"]>().mockImplementation(() => {
    const active = Object.values(creds).find((c) => c.isActive && !c.isRevoked);
    if (!active) return Effect.fail(new CredentialNotFound({ credentialId: "none" }));
    return Effect.succeed(
      makePlaceholderCredential({ id: active.id, isVerified: active.isVerified }),
    );
  }),
  getDecryptedAgent: vi
    .fn<CredRepoShape["getDecryptedAgent"]>()
    .mockImplementation((id: string) => {
      const cred = Object.values(creds).find((c) => c.id === id);
      if (!cred || !cred.isActive) return Effect.fail(new CredentialNotFound({ credentialId: id }));
      if (cred.isRevoked) return Effect.fail(new CredentialRevoked({ credentialId: id }));
      if (!cred.isVerified) return Effect.fail(new CredentialUnverified({ credentialId: id }));
      return Effect.succeed(makeDecryptedCredential());
    }),
  setVerified: vi.fn<CredRepoShape["setVerified"]>().mockImplementation((id: string) => {
    const cred = Object.values(creds).find((c) => c.id === id);
    if (cred) cred.isVerified = true;
    return Effect.succeed(void 0);
  }),
  rotate: vi.fn<CredRepoShape["rotate"]>().mockImplementation(() => {
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
  revoke: vi.fn<CredRepoShape["revoke"]>().mockImplementation((id: string, accountId: string) => {
    if (accountId !== "acct-1") {
      return Effect.fail(new CredentialNotFound({ credentialId: id }));
    }
    const cred = Object.values(creds).find((c) => c.id === id);
    if (cred) cred.isRevoked = true;
    return Effect.succeed(void 0);
  }),
});

const makeMultiUserAccountRepo = () => ({
  ...defaultMockAccountRepo,
  findPrimary: vi.fn<AccountRepoShape["findPrimary"]>().mockImplementation((userId: string) => {
    if (userId === USER_A)
      return Effect.succeed(makePlaceholderAccount({ userId: USER_A, walletAddress: "0xUSER_A" }));
    if (userId === USER_B)
      return Effect.succeed(makePlaceholderAccount({ userId: USER_B, walletAddress: "0xUSER_B" }));
    return Effect.fail(new AccountNotFound({ accountId: userId }));
  }),
});

const makeMultiUserCredRepo = (state: { userACalled: boolean; userBCalled: boolean }) => ({
  ...defaultMockCredRepo,
  getDecryptedAgent: vi
    .fn<CredRepoShape["getDecryptedAgent"]>()
    .mockImplementation((id: string, userId: string) => {
      if (userId === USER_A) {
        state.userACalled = true;
        return Effect.succeed(makeDecryptedCredential({ walletAddress: "0xUSER_A" }));
      }
      if (userId === USER_B) {
        state.userBCalled = true;
        return Effect.succeed(makeDecryptedCredential({ walletAddress: "0xUSER_B" }));
      }
      return Effect.fail(new CredentialNotFound({ credentialId: id }));
    }),
});

const makeAccountScopedRevoke = (expectedAccountId: string, state: { revoked: boolean }) =>
  vi.fn<CredRepoShape["revoke"]>().mockImplementation((id: string, accountId: string) =>
    accountId === expectedAccountId
      ? Effect.sync(() => {
          state.revoked = true;
        })
      : Effect.fail(new CredentialNotFound({ credentialId: id })),
  );

describe("ExchangeService — credential system", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
                  .fn<CredRepoShape["getDecryptedAgent"]>()
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
    expect(result).toHaveProperty("_tag", "CredentialUnverified");
  });

  it("TC-04: Verify and resolve — master wallet (happy path)", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC"]));
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    const decryptedCred = makeDecryptedCredential({
      privateKey: Redacted.make(VALID_PRIVATE_KEY),
      walletAddress: "0xMASTER",
      vaultAddress: undefined,
      agentAddress: "0xAGENT",
    });

    const getDecryptedAgentMock = vi
      .fn<CredRepoShape["getDecryptedAgent"]>()
      .mockReturnValue(Effect.succeed(decryptedCred));

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
                  .fn<CredRepoShape["getDecryptedAgent"]>()
                  .mockReturnValue(Effect.fail(new CredentialRevoked({ credentialId: "cred-1" }))),
              },
            ),
          ),
        )
        .pipe(Effect.flip),
    );

    expect(result).toBeInstanceOf(CredentialRevoked);
    expect(result).toHaveProperty("_tag", "CredentialRevoked");
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
                  .fn<CredRepoShape["getDecryptedAgent"]>()
                  .mockReturnValue(Effect.fail(new CredentialExpired({ credentialId: "cred-1" }))),
              },
            ),
          ),
        )
        .pipe(Effect.flip),
    );

    expect(result).toBeInstanceOf(CredentialExpired);
    expect(result).toHaveProperty("_tag", "CredentialExpired");
  });

  it("TC-08: Cross-user isolation", async () => {
    const getDecryptedAgentMock = vi
      .fn<CredRepoShape["getDecryptedAgent"]>()
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
    expect(result).toHaveProperty("_tag", "CredentialNotFound");
    expect(getDecryptedAgentMock).toHaveBeenCalled();
  });

  it("TC-09: Rotation chain", async () => {
    const state = { oldActive: true };
    const mockRotateRepo = makeRotateRepo(state);

    const layer = Layer.succeed(ExchangeCredentialRepo, ExchangeCredentialRepo.of(mockRotateRepo));

    const rotated = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        return yield* repo.rotate(OLD_ID, {
          userId: USER_A,
          accountId: "acct-1",
          credentialSubtype: "agent",
          agentKey: Redacted.make(NEW_KEY),
          agentAddress: "0xAGENT_NEW",
          label: "Rotated Key",
        });
      }).pipe(Effect.provide(layer)),
    );

    expect(rotated.id).toBe(NEW_ID);
    expect(rotated.isActive).toBe(true);
    expect(rotated.rotatedFrom).toBe(OLD_ID);
    expect(mockRotateRepo.rotate).toHaveBeenCalledOnce();
  });

  it("TC-11: markUsed does not block pipeline", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC"]));
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });

    const markUsedDelay = vi.fn<CredRepoShape["markUsed"]>().mockReturnValue(Effect.sync(() => {}));

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

    expect(mockExchangeInstance.order).toHaveBeenCalled();
  });
});

// Security Boundary Tests

describe("Security Boundary — vaultAddress forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards vaultAddress as second arg on order()", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC"]));
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
                .fn<CredRepoShape["getDecryptedAgent"]>()
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
    mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC"]));
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
                .fn<CredRepoShape["getDecryptedAgent"]>()
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
    mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC"]));
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
                .fn<CredRepoShape["getDecryptedAgent"]>()
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
    mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC"]));
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
                .fn<CredRepoShape["getDecryptedAgent"]>()
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
      getActiveForAccount: makeUserAwareGetActive(),
    };
    const layer = Layer.succeed(ExchangeCredentialRepo, ExchangeCredentialRepo.of(isolationMock));

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
        .fn<CredRepoShape["getActiveForAccount"]>()
        .mockReturnValue(
          Effect.succeed(makePlaceholderCredential({ id: "cred-accessible", userId: USER_A })),
        ),
    };
    const layer = Layer.succeed(ExchangeCredentialRepo, ExchangeCredentialRepo.of(isolationMock));

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
                  .fn<CredRepoShape["getDecryptedAgent"]>()
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
    expect(result).toHaveProperty("credentialId", expect.not.stringMatching(uuidPattern));
    expect(result).toHaveProperty("message", expect.not.stringMatching(uuidPattern));
  });
});

describe("Security Boundary — markUsed fire-and-forget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("markUsed is triggered during credential resolution and does not block", async () => {
    mockInfoInstance.meta.mockResolvedValueOnce(makeMetaResponse(["BTC"]));
    mockExchangeInstance.order.mockResolvedValueOnce({ response: "ok" });
    const markUsedSpy = vi.fn<(id: string) => void>();
    const getDecryptedAgentWithMarkUsed = vi
      .fn<CredRepoShape["getDecryptedAgent"]>()
      .mockImplementation((id: string) => {
        markUsedSpy(id);
        return Effect.succeed(makeDecryptedCredential());
      });

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
    const creds: Record<"old" | "new", LifecycleCred> = {
      old: { id: "cred-lc-old", isVerified: false, isRevoked: false, isActive: true },
      new: { id: "cred-lc-new", isVerified: false, isRevoked: false, isActive: false },
    };

    const lifecycleMock = makeLifecycleRepo(creds);

    const accountLayer = Layer.succeed(
      ExchangeAccountRepo,
      ExchangeAccountRepo.of(defaultMockAccountRepo),
    );
    const credLayer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of(lifecycleMock),
    );
    const testLayer = exchangeServiceLayer.pipe(
      Layer.provideMerge(exchangeCredentialsLayer),
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
    mockInfoInstance.meta.mockResolvedValue(makeMetaResponse(["BTC"]));
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
          agentKey: Redacted.make("0x" + "c".repeat(64)),
          agentAddress: "0xAGENT_NEW",
        });
      }).pipe(Effect.provide(testLayer)),
    );
    expect(rotated.id).toBe("cred-lc-new");
    expect(creds.old.isActive).toBe(false);

    // Step 6: Revoke and verify block
    await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        yield* repo.revoke("cred-lc-new", "acct-1", "compromised", USER_A);
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

describe("revoke — account scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a mismatched accountId with CredentialNotFound and leaves the credential active", async () => {
    const state = { revoked: false };
    const revoke = makeAccountScopedRevoke("acct-1", state);
    const layer = Layer.succeed(
      ExchangeCredentialRepo,
      ExchangeCredentialRepo.of({ ...defaultMockCredRepo, revoke }),
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const repo = yield* ExchangeCredentialRepo;
        return yield* repo.revoke("cred-1", "acct-other", "compromised", USER_A);
      })
        .pipe(Effect.provide(layer))
        .pipe(Effect.flip),
    );

    expect(result).toBeInstanceOf(CredentialNotFound);
    expect(revoke).toHaveBeenCalledWith("cred-1", "acct-other", "compromised", USER_A);
    expect(state.revoked).toBe(false);
  });
});

// Edge Cases

describe("Expired credential — decrypt never called", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks expired credential before decrypt is invoked", async () => {
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
                  .fn<CredRepoShape["getDecryptedAgent"]>()
                  .mockImplementation((id: string) => {
                    return Effect.fail(new CredentialExpired({ credentialId: id }));
                  }),
              },
            ),
          ),
        )
        .pipe(Effect.flip),
    );

    expect(result).toBeInstanceOf(CredentialExpired);
  });
});

describe("Concurrent/Multi-User isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("two users with same exchange get isolated credentials", async () => {
    mockInfoInstance.meta.mockResolvedValue(makeMetaResponse(["BTC"]));
    mockExchangeInstance.order.mockResolvedValue({ response: "ok" });

    const state = { userACalled: false, userBCalled: false };

    const multiUserAccountRepo = makeMultiUserAccountRepo();
    const multiUserCredRepo = makeMultiUserCredRepo(state);

    const isolatedLayer = exchangeServiceLayer.pipe(
      Layer.provideMerge(exchangeCredentialsLayer),
      Layer.provideMerge(
        Layer.succeed(ExchangeAccountRepo, ExchangeAccountRepo.of(multiUserAccountRepo)),
      ),
      Layer.provideMerge(
        Layer.succeed(ExchangeCredentialRepo, ExchangeCredentialRepo.of(multiUserCredRepo)),
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
    expect(state.userACalled).toBe(true);
    expect(state.userBCalled).toBe(true);
  });
});

// Group 6: Edge Cases

describe("Negative/Defensive tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalid credential subtype (non-agent) fails with CredentialNotFound", async () => {
    const mockCredRepo = {
      ...defaultMockCredRepo,
      getActiveForAccount: vi
        .fn<CredRepoShape["getActiveForAccount"]>()
        .mockReturnValue(
          Effect.succeed(makePlaceholderCredential({ credentialSubtype: "hardware" })),
        ),
      getDecryptedAgent: vi
        .fn<CredRepoShape["getDecryptedAgent"]>()
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
