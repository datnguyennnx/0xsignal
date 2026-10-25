import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Context, Effect, Layer } from "effect";
import { MarketDataService } from "../../../modules/market-data";
import { HealthService } from "../../../modules/health";
import { UserDataService } from "../../../modules/user-data";
import { handleRequest } from "../../../app";
import { TestRouteEnvLayer } from "../../../app/__tests__/route-test-layer";

const WALLET = `0x${"1".repeat(40)}`;
const OTHER_WALLET = `0x${"2".repeat(40)}`;

const mockUserDataService = {
  getUserFills: vi.fn<Context.Service.Shape<typeof UserDataService>["getUserFills"]>(),
  getUserFunding: vi.fn<Context.Service.Shape<typeof UserDataService>["getUserFunding"]>(),
};

const TestUserDataLayer = Layer.mock(UserDataService, mockUserDataService);

const TestMarketDataLayer = Layer.mock(MarketDataService, {});
const TestHealthLayer = Layer.mock(HealthService, {});

const runRequest = (path: string) =>
  Effect.runPromise(
    handleRequest(new Request(`http://localhost${path}`)).pipe(
      Effect.provide(
        Layer.mergeAll(TestMarketDataLayer, TestHealthLayer, TestUserDataLayer, TestRouteEnvLayer),
      ),
    ),
  );

const errorText = async (response: Response): Promise<string> =>
  JSON.stringify(await response.json());

describe("HTTP User Data Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUserDataService.getUserFills.mockReturnValue(Effect.succeed([]));
    mockUserDataService.getUserFunding.mockReturnValue(Effect.succeed([]));
  });

  it("passes a valid wallet address through", async () => {
    const response = await runRequest(`/api/user/fills?walletAddress=${WALLET}`);

    expect(response.status).toBe(200);
    expect(mockUserDataService.getUserFills).toHaveBeenCalledWith(WALLET);
  });

  it("rejects a missing wallet address with a 400 naming the field", async () => {
    const response = await runRequest("/api/user/fills");

    expect(response.status).toBe(400);
    expect(await errorText(response)).toContain("walletAddress");
  });

  it("rejects a malformed wallet address with a 400 naming the field", async () => {
    const response = await runRequest("/api/user/fills?walletAddress=not-an-address");

    expect(response.status).toBe(400);
    expect(await errorText(response)).toContain("walletAddress");
  });

  it("decodes numeric start and end times", async () => {
    const response = await runRequest(
      `/api/user/funding?walletAddress=${OTHER_WALLET}&startTime=1000&endTime=2000`,
    );

    expect(response.status).toBe(200);
    expect(mockUserDataService.getUserFunding).toHaveBeenCalledWith(OTHER_WALLET, 1000, 2000);
  });

  it("rejects a non-numeric startTime with a 400 naming the field", async () => {
    const response = await runRequest(`/api/user/funding?walletAddress=${WALLET}&startTime=soon`);

    expect(response.status).toBe(400);
    expect(await errorText(response)).toContain("startTime");
  });
});
