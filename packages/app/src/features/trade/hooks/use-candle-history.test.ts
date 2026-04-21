import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchByRange, useCandleHistory } from "./use-candle-history";

const { mockUseQuery, mockGetRecentChartLane, mockGetCandles } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockGetRecentChartLane: vi.fn(),
  mockGetCandles: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: Symbol("keepPreviousData"),
  useQuery: mockUseQuery,
}));

vi.mock("@/services/api", () => ({
  api: {
    getRecentChartLane: mockGetRecentChartLane,
    getCandles: mockGetCandles,
  },
}));

describe("useCandleHistory", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
    mockGetRecentChartLane.mockReset();
    mockGetCandles.mockReset();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false, error: null });
    mockGetRecentChartLane.mockResolvedValue([]);
    mockGetCandles.mockResolvedValue([]);
  });

  it("uses recent-chart-lane endpoint contract for initial history", async () => {
    useCandleHistory("ETHUSDC", "1m", 250, true);

    const queryOptions = mockUseQuery.mock.calls[0]?.[0] as { queryFn: () => Promise<unknown> };
    await queryOptions.queryFn();

    expect(mockGetRecentChartLane).toHaveBeenCalledWith({
      symbol: "ETH",
      interval: "1m",
      limit: 250,
    });
  });

  it("keeps range fetch behavior for loadMore", async () => {
    await fetchByRange("ETH", "1m", 1000, 2000);

    expect(mockGetCandles).toHaveBeenCalledWith({
      symbol: "ETH",
      interval: "1m",
      startTime: 1000,
      endTime: 2000,
    });
  });
});
