import { vi } from "vitest";
import { Layer } from "effect";
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { HyperliquidClient } from "../../../integrations/hyperliquid/data-sources/hyperliquid-client";

export { HyperliquidValidationError } from "../../../shared/errors";

export const USER_A = "user-a";

type MetaResponse = Awaited<ReturnType<InfoClient["meta"]>>;

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
