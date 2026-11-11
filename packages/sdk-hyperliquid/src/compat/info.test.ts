import { describe, expect, test } from "bun:test";
import { cast } from "../core/parse";
import { Transport } from "../core/transport";
import { InfoClient } from "../info/client";

const USER = "0x1111111111111111111111111111111111111111";
const BUILDER = "0x2222222222222222222222222222222222222222";
const VAULT = "0x3333333333333333333333333333333333333333";

class RecordingTransport extends Transport {
  readonly bodies: Record<string, unknown>[] = [];

  constructor() {
    super({ retries: 0 });
  }

  override postInfo<T>(
    body: Record<string, unknown>,
    _parse: (u: unknown) => T,
    _weight: number,
  ): Promise<T> {
    this.bodies.push(body);
    return Promise.resolve(cast<T>({}, "response"));
  }
}

type InfoCase = {
  readonly wireType: string;
  readonly required: readonly string[];
  readonly params: Record<string, unknown>;
};

const CASES: Record<string, InfoCase> = {
  allMids: { wireType: "allMids", required: [], params: {} },
  openOrders: { wireType: "openOrders", required: ["user"], params: { user: USER } },
  frontendOpenOrders: {
    wireType: "frontendOpenOrders",
    required: ["user"],
    params: { user: USER },
  },
  userFills: { wireType: "userFills", required: ["user"], params: { user: USER } },
  userFillsByTime: {
    wireType: "userFillsByTime",
    required: ["user", "startTime"],
    params: { user: USER, startTime: 0 },
  },
  userRateLimit: {
    wireType: "userRateLimit",
    required: ["user"],
    params: { user: USER },
  },
  orderStatus: {
    wireType: "orderStatus",
    required: ["user", "oid"],
    params: { user: USER, oid: 1 },
  },
  l2Book: { wireType: "l2Book", required: ["coin"], params: { coin: "BTC" } },
  candleSnapshot: {
    wireType: "candleSnapshot",
    required: ["req"],
    params: {
      req: { coin: "BTC", interval: "1m", startTime: 0, endTime: 100 },
    },
  },
  maxBuilderFee: {
    wireType: "maxBuilderFee",
    required: ["user", "builder"],
    params: { user: USER, builder: BUILDER },
  },
  historicalOrders: {
    wireType: "historicalOrders",
    required: ["user"],
    params: { user: USER },
  },
  userTwapSliceFills: {
    wireType: "userTwapSliceFills",
    required: ["user"],
    params: { user: USER },
  },
  subAccounts: { wireType: "subAccounts", required: ["user"], params: { user: USER } },
  vaultDetails: {
    wireType: "vaultDetails",
    required: ["vaultAddress"],
    params: { vaultAddress: VAULT },
  },
  userVaultEquities: {
    wireType: "userVaultEquities",
    required: ["user"],
    params: { user: USER },
  },
  userRole: { wireType: "userRole", required: ["user"], params: { user: USER } },
  portfolio: { wireType: "portfolio", required: ["user"], params: { user: USER } },
  referral: { wireType: "referral", required: ["user"], params: { user: USER } },
  userFees: { wireType: "userFees", required: ["user"], params: { user: USER } },
  delegations: { wireType: "delegations", required: ["user"], params: { user: USER } },
  delegatorSummary: {
    wireType: "delegatorSummary",
    required: ["user"],
    params: { user: USER },
  },
  delegatorHistory: {
    wireType: "delegatorHistory",
    required: ["user"],
    params: { user: USER },
  },
  delegatorRewards: {
    wireType: "delegatorRewards",
    required: ["user"],
    params: { user: USER },
  },
  userDexAbstraction: {
    wireType: "userDexAbstraction",
    required: ["user"],
    params: { user: USER },
  },
  userAbstraction: {
    wireType: "userAbstraction",
    required: ["user"],
    params: { user: USER },
  },
  borrowLendUserState: {
    wireType: "borrowLendUserState",
    required: ["user"],
    params: { user: USER },
  },
  borrowLendReserveState: {
    wireType: "borrowLendReserveState",
    required: ["token"],
    params: { token: 0 },
  },
  allBorrowLendReserveStates: {
    wireType: "allBorrowLendReserveStates",
    required: [],
    params: {},
  },
  approvedBuilders: {
    wireType: "approvedBuilders",
    required: ["user"],
    params: { user: USER },
  },
  perpDexs: { wireType: "perpDexs", required: [], params: {} },
  meta: { wireType: "meta", required: [], params: {} },
  metaAndAssetCtxs: { wireType: "metaAndAssetCtxs", required: [], params: {} },
  clearinghouseState: {
    wireType: "clearinghouseState",
    required: ["user"],
    params: { user: USER },
  },
  userFunding: {
    wireType: "userFunding",
    required: ["user", "startTime"],
    params: { user: USER, startTime: 0 },
  },
  userNonFundingLedgerUpdates: {
    wireType: "userNonFundingLedgerUpdates",
    required: ["user", "startTime"],
    params: { user: USER, startTime: 0 },
  },
  fundingHistory: {
    wireType: "fundingHistory",
    required: ["coin", "startTime"],
    params: { coin: "BTC", startTime: 0 },
  },
  predictedFundings: { wireType: "predictedFundings", required: [], params: {} },
  perpsAtOpenInterestCap: {
    wireType: "perpsAtOpenInterestCap",
    required: [],
    params: {},
  },
  perpDeployAuctionStatus: {
    wireType: "perpDeployAuctionStatus",
    required: [],
    params: {},
  },
  activeAssetData: {
    wireType: "activeAssetData",
    required: ["user", "coin"],
    params: { user: USER, coin: "BTC" },
  },
  perpDexLimits: { wireType: "perpDexLimits", required: ["dex"], params: { dex: "dex" } },
  perpDexStatus: { wireType: "perpDexStatus", required: ["dex"], params: { dex: "dex" } },
  allPerpMetas: { wireType: "allPerpMetas", required: [], params: {} },
  perpAnnotation: {
    wireType: "perpAnnotation",
    required: ["coin"],
    params: { coin: "BTC" },
  },
  perpCategories: { wireType: "perpCategories", required: [], params: {} },
  perpConciseAnnotations: {
    wireType: "perpConciseAnnotations",
    required: [],
    params: {},
  },
  spotMeta: { wireType: "spotMeta", required: [], params: {} },
  spotMetaAndAssetCtxs: {
    wireType: "spotMetaAndAssetCtxs",
    required: [],
    params: {},
  },
  spotClearinghouseState: {
    wireType: "spotClearinghouseState",
    required: ["user"],
    params: { user: USER },
  },
  spotDeployState: {
    wireType: "spotDeployState",
    required: ["user"],
    params: { user: USER },
  },
  spotPairDeployAuctionStatus: {
    wireType: "spotPairDeployAuctionStatus",
    required: [],
    params: {},
  },
  spotTokenDetails: {
    wireType: "tokenDetails",
    required: ["tokenId"],
    params: { tokenId: "1" },
  },
  spotOutcomeMeta: { wireType: "outcomeMeta", required: [], params: {} },
  spotOutcomeTemplates: { wireType: "outcomeTemplates", required: [], params: {} },
  spotSettledOutcome: {
    wireType: "settledOutcome",
    required: ["outcome"],
    params: { outcome: 1 },
  },
  spotOutcomeDeployerLimits: {
    wireType: "outcomeDeployerLimits",
    required: ["venue"],
    params: { venue: "venue" },
  },
  recentTrades: {
    wireType: "recentTrades",
    required: ["coin"],
    params: { coin: "BTC" },
  },
  twapHistory: { wireType: "twapHistory", required: ["user"], params: { user: USER } },
  userTwapSliceFillsByTime: {
    wireType: "userTwapSliceFillsByTime",
    required: ["user", "startTime"],
    params: { user: USER, startTime: 0 },
  },
  validatorStats: {
    wireType: "validatorStats",
    required: ["validator"],
    params: { validator: USER },
  },
  userStarState: {
    wireType: "userStarState",
    required: ["user"],
    params: { user: USER },
  },
  exchangeStatus: { wireType: "exchangeStatus", required: [], params: {} },
};

const invoke = (client: InfoClient, name: string, params: unknown): Promise<unknown> => {
  const table = cast<Record<string, (p: unknown) => Promise<unknown>>>(client, "InfoClient");
  const method = table[name];
  if (method === undefined) throw new Error(`unknown InfoClient method ${name}`);
  return method.call(client, params);
};

const firstBody = (bodies: readonly Record<string, unknown>[]): Record<string, unknown> => {
  const [body] = bodies;
  if (body === undefined) throw new Error("no info body recorded");
  return body;
};

const methodNames = Object.getOwnPropertyNames(InfoClient.prototype)
  .filter((name) => name !== "constructor")
  .sort();

describe("InfoClient wire surface", () => {
  test("every prototype method has a compatibility case", () => {
    expect(methodNames.length).toBe(62);
    expect(methodNames).toEqual(Object.keys(CASES).sort());
  });

  for (const [name, info] of Object.entries(CASES)) {
    test(`${name} posts wire type ${info.wireType}`, async () => {
      const transport = new RecordingTransport();
      const client = new InfoClient(transport);
      await invoke(client, name, info.params);

      const body = firstBody(transport.bodies);

      expect(Object.keys(body)[0]).toBe("type");
      expect(body["type"]).toBe(info.wireType);
      expect(Object.prototype.hasOwnProperty.call(info.params, "type")).toBe(false);
      for (const key of info.required) {
        expect(body[key]).toBeDefined();
      }
    });
  }

  test("candleSnapshot accepts a 30-day 1h range and sends it unchanged", async () => {
    const transport = new RecordingTransport();
    const client = new InfoClient(transport);
    const req = {
      coin: "BTC",
      interval: "1h" as const,
      startTime: 1_700_000_000_000,
      endTime: 1_700_000_000_000 + 2_592_000_000,
    };

    await client.candleSnapshot({ req });

    const body = firstBody(transport.bodies);
    expect(body).toEqual({ type: "candleSnapshot", req });
  });
});
