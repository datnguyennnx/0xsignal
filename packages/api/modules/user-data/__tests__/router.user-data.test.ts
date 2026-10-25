import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Context, Effect, Layer } from "effect";
import {
  AuthService,
  ExchangeAccountRepo,
  AgentRegistrationRepo,
  makeUserId,
  type ExchangeAccount,
  type Session,
} from "@0xsignal/auth";
import { UserDataService } from "../../../modules/user-data";
import { MarketDataService } from "../../../modules/market-data";
import { HealthService } from "../../../modules/health";
import { OrderIntentService } from "../../../modules/exchange";
import { handleRequest } from "../../../app";

const WALLET = `0x${"1".repeat(40)}`;
const OTHER_WALLET = `0x${"2".repeat(40)}`;
const STRANGER_WALLET = `0x${"3".repeat(40)}`;

const USER_ID = makeUserId("user-1");

const SESSION: Session = { userId: USER_ID, provider: "google", jti: "jti-1" };

const accountFor = (walletAddress: string): ExchangeAccount => ({
  id: `account-${walletAddress}`,
  userId: USER_ID,
  exchangeId: "exchange-1",
  nodeType: "wallet",
  walletAddress,
  label: "",
  sortOrder: 0,
  isActive: true,
  isPrimary: true,
  metadata: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const mockUserDataService = {
  getUserFills: vi.fn<Context.Service.Shape<typeof UserDataService>["getUserFills"]>(),
  getUserFunding: vi.fn<Context.Service.Shape<typeof UserDataService>["getUserFunding"]>(),
};

const TestUserDataLayer = Layer.mock(UserDataService, mockUserDataService);

const makeLayer = (ownedWallets: ReadonlyArray<string>) =>
  Layer.mergeAll(
    TestUserDataLayer,
    Layer.mock(MarketDataService, {}),
    Layer.mock(HealthService, {}),
    Layer.mock(OrderIntentService, {}),
    Layer.mock(AuthService, { verifyToken: () => Effect.succeed(SESSION) }),
    Layer.mock(ExchangeAccountRepo, {
      findByUserId: () => Effect.succeed(ownedWallets.map((wallet) => accountFor(wallet))),
    }),
    Layer.mock(AgentRegistrationRepo, {}),
  );

const runRequest = (path: string, token?: string) =>
  Effect.runPromise(
    handleRequest(
      new Request(
        `http://localhost${path}`,
        token === undefined ? {} : { headers: { Authorization: `Bearer ${token}` } },
      ),
    ).pipe(Effect.provide(makeLayer([WALLET, OTHER_WALLET]))),
  );

const errorText = async (response: Response): Promise<string> =>
  JSON.stringify(await response.json());

describe("HTTP User Data Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUserDataService.getUserFills.mockReturnValue(Effect.succeed([]));
    mockUserDataService.getUserFunding.mockReturnValue(Effect.succeed([]));
  });

  it("rejects an unauthenticated request", async () => {
    const response = await runRequest(`/api/user/clearinghouse-state?walletAddress=${WALLET}`);

    expect(response.status).toBe(401);
    expect(await errorText(response)).toContain("Unauthorized");
    expect(mockUserDataService.getUserFills).not.toHaveBeenCalled();
  });

  it("rejects a wallet that belongs to another user with 403", async () => {
    const response = await runRequest(
      `/api/user/fills?walletAddress=${STRANGER_WALLET}`,
      "valid-token",
    );

    expect(response.status).toBe(403);
    expect(await errorText(response)).toContain("does not belong to the authenticated user");
    expect(mockUserDataService.getUserFills).not.toHaveBeenCalled();
  });

  it("serves the authenticated user's own wallet", async () => {
    const response = await runRequest(`/api/user/fills?walletAddress=${WALLET}`, "valid-token");

    expect(response.status).toBe(200);
    expect(mockUserDataService.getUserFills).toHaveBeenCalledWith(WALLET);
  });

  it("passes a valid wallet address through", async () => {
    const response = await runRequest(`/api/user/fills?walletAddress=${WALLET}`, "valid-token");

    expect(response.status).toBe(200);
    expect(mockUserDataService.getUserFills).toHaveBeenCalledWith(WALLET);
  });

  it("rejects a missing wallet address with a 400 naming the field", async () => {
    const response = await runRequest("/api/user/fills", "valid-token");

    expect(response.status).toBe(400);
    expect(await errorText(response)).toContain("walletAddress");
  });

  it("rejects a malformed wallet address with a 400 naming the field", async () => {
    const response = await runRequest(
      "/api/user/fills?walletAddress=not-an-address",
      "valid-token",
    );

    expect(response.status).toBe(400);
    expect(await errorText(response)).toContain("walletAddress");
  });

  it("decodes numeric start and end times", async () => {
    const response = await runRequest(
      `/api/user/funding?walletAddress=${OTHER_WALLET}&startTime=1000&endTime=2000`,
      "valid-token",
    );

    expect(response.status).toBe(200);
    expect(mockUserDataService.getUserFunding).toHaveBeenCalledWith(OTHER_WALLET, 1000, 2000);
  });

  it("rejects a non-numeric startTime with a 400 naming the field", async () => {
    const response = await runRequest(
      `/api/user/funding?walletAddress=${WALLET}&startTime=soon`,
      "valid-token",
    );

    expect(response.status).toBe(400);
    expect(await errorText(response)).toContain("startTime");
  });
});
