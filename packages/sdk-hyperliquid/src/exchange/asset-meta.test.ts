import { describe, expect, test } from "bun:test";
import { asAddress, asDecimal } from "../core/brands";
import { ValidationError } from "../core/errors";
import { map, toBytesMap, type MpMap } from "../core/msgpack";
import type { MetaInfoResponse, SpotMetaInfoResponse } from "../info/types/index";
import {
  APPROVE_AGENT,
  APPROVE_BUILDER_FEE,
  SEND_ASSET,
  SPOT_SEND,
  USD_CLASS_TRANSFER,
  USD_SEND,
  WITHDRAW,
  encodeHip3LiquidatorTransfer,
} from "./actions/index";
import { assetInfoFromMeta, assetInfoFromSpotMeta } from "./asset-meta";

const ADDRESS = asAddress("0x1111111111111111111111111111111111111111");
const ZERO = asAddress("0x0000000000000000000000000000000000000000");
const CHAIN = { hyperliquidChain: "Mainnet", signatureChainId: "0xa4b1" } as const;
const TIME = 1_700_000_000;

const bytesOf = (wire: MpMap): number[] => Array.from(toBytesMap(wire));

const expectPath = (run: () => unknown, path: string): void => {
  try {
    run();
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    expect(error.path).toBe(path);
    return;
  }
  throw new Error(`expected ValidationError at ${path}`);
};

const WITHDRAW_ACTION = {
  destination: ADDRESS,
  amount: asDecimal("1.5"),
  time: TIME,
  ...CHAIN,
};
const USD_CLASS_ACTION = { amount: asDecimal("100"), toPerp: true, nonce: 7, ...CHAIN };
const SEND_ASSET_ACTION = {
  destination: ADDRESS,
  sourceDex: "",
  destinationDex: "",
  token: 0,
  amount: asDecimal("2"),
  fromSubAccount: false,
  nonce: 7,
  ...CHAIN,
};
const USD_SEND_ACTION = { destination: ADDRESS, amount: asDecimal("3"), time: TIME, ...CHAIN };
const SPOT_SEND_ACTION = {
  destination: ADDRESS,
  token: "PURR:0x01",
  amount: asDecimal("4"),
  time: TIME,
  ...CHAIN,
};
const APPROVE_AGENT_ACTION = { agentAddress: ADDRESS, agentName: "agent", nonce: 7, ...CHAIN };
const APPROVE_BUILDER_ACTION = { maxFeeRate: "0.01%", builder: ADDRESS, nonce: 7, ...CHAIN };

describe("assetInfoFromMeta", () => {
  const meta: MetaInfoResponse = {
    universe: [
      { name: "BTC", szDecimals: 5, maxLeverage: 50 },
      { name: "ETH", szDecimals: 4, maxLeverage: 25 },
    ],
    marginTables: [],
  };

  test("resolves the universe index and perp decimal cap", () => {
    expect(assetInfoFromMeta(meta, "ETH")).toEqual({
      name: "ETH",
      assetId: 1,
      szDecimals: 4,
      maxDecimals: 6,
      isSpot: false,
    });
  });

  test("applies the builder-dex id formula when dexIndex is given", () => {
    expect(assetInfoFromMeta(meta, "ETH", { dex: "xyz", dexIndex: 1 })).toEqual({
      name: "ETH",
      assetId: 110_001,
      szDecimals: 4,
      maxDecimals: 6,
      isSpot: false,
      dex: "xyz",
    });
  });

  test("names the tried key when the symbol is absent", () => {
    expectPath(() => assetInfoFromMeta(meta, "DOGE"), 'meta.universe["DOGE"]');
  });

  test("rejects a spot flag on perp metadata", () => {
    expectPath(() => assetInfoFromMeta(meta, "ETH", { isSpot: true }), "opts.isSpot");
  });

  test("rejects a negative dexIndex", () => {
    expectPath(() => assetInfoFromMeta(meta, "ETH", { dexIndex: -1 }), "opts.dexIndex");
  });
});

describe("assetInfoFromSpotMeta", () => {
  const spot: SpotMetaInfoResponse = {
    tokens: [
      {
        name: "PURR",
        szDecimals: 0,
        weiDecimals: 8,
        index: 0,
        tokenId: "0x01",
        isCanonical: true,
        evmContract: null,
        fullName: null,
      },
      {
        name: "USDC",
        szDecimals: 6,
        weiDecimals: 8,
        index: 1,
        tokenId: "0x02",
        isCanonical: true,
        evmContract: null,
        fullName: null,
      },
    ],
    universe: [{ name: "PURR/USDC", tokens: [0, 1], index: 0, isCanonical: true }],
  };

  test("resolves 10000 + universe.index and base token decimals", () => {
    expect(assetInfoFromSpotMeta(spot, "PURR/USDC")).toEqual({
      name: "PURR/USDC",
      assetId: 10_000,
      szDecimals: 0,
      maxDecimals: 8,
      isSpot: true,
    });
  });

  test("names the tried pair when absent", () => {
    expectPath(() => assetInfoFromSpotMeta(spot, "DOGE/USDC"), 'spotMeta.universe["DOGE/USDC"]');
  });
});

describe("money-moving action rules", () => {
  test("withdraw3 valid case is byte-identical", () => {
    expect(bytesOf(WITHDRAW.encode(WITHDRAW_ACTION))).toEqual(
      bytesOf(
        map([
          ["type", "withdraw3"],
          ["signatureChainId", "0xa4b1"],
          ["hyperliquidChain", "Mainnet"],
          ["destination", ADDRESS],
          ["amount", asDecimal("1.5")],
          ["time", TIME],
        ]),
      ),
    );
  });

  test("withdraw3 rejects zero destination and non-positive amount", () => {
    expectPath(
      () => WITHDRAW.encode({ ...WITHDRAW_ACTION, destination: ZERO }),
      "action.destination",
    );
    expectPath(
      () => WITHDRAW.encode({ ...WITHDRAW_ACTION, amount: asDecimal("0") }),
      "action.amount",
    );
    expectPath(
      () => WITHDRAW.encode({ ...WITHDRAW_ACTION, amount: asDecimal("-1") }),
      "action.amount",
    );
  });

  test("usdClassTransfer valid case is byte-identical", () => {
    expect(bytesOf(USD_CLASS_TRANSFER.encode(USD_CLASS_ACTION))).toEqual(
      bytesOf(
        map([
          ["type", "usdClassTransfer"],
          ["amount", asDecimal("100")],
          ["toPerp", true],
          ["nonce", 7],
        ]),
      ),
    );
  });

  test("usdClassTransfer rejects non-positive amount", () => {
    expectPath(
      () => USD_CLASS_TRANSFER.encode({ ...USD_CLASS_ACTION, amount: asDecimal("0") }),
      "action.amount",
    );
    expectPath(
      () => USD_CLASS_TRANSFER.encode({ ...USD_CLASS_ACTION, amount: asDecimal("-0.1") }),
      "action.amount",
    );
  });

  test("sendAsset valid case is byte-identical", () => {
    expect(bytesOf(SEND_ASSET.encode(SEND_ASSET_ACTION))).toEqual(
      bytesOf(
        map([
          ["type", "sendAsset"],
          ["destination", ADDRESS],
          ["sourceDex", ""],
          ["destinationDex", ""],
          ["token", 0],
          ["amount", asDecimal("2")],
          ["fromSubAccount", false],
          ["nonce", 7],
        ]),
      ),
    );
  });

  test("sendAsset rejects non-positive amount", () => {
    expectPath(
      () => SEND_ASSET.encode({ ...SEND_ASSET_ACTION, amount: asDecimal("0") }),
      "action.amount",
    );
  });

  test("usdSend valid case is byte-identical", () => {
    expect(bytesOf(USD_SEND.encode(USD_SEND_ACTION))).toEqual(
      bytesOf(
        map([
          ["type", "usdSend"],
          ["destination", ADDRESS],
          ["amount", asDecimal("3")],
          ["time", TIME],
        ]),
      ),
    );
  });

  test("usdSend rejects non-positive amount", () => {
    expectPath(
      () => USD_SEND.encode({ ...USD_SEND_ACTION, amount: asDecimal("0") }),
      "action.amount",
    );
  });

  test("spotSend valid case is byte-identical", () => {
    expect(bytesOf(SPOT_SEND.encode(SPOT_SEND_ACTION))).toEqual(
      bytesOf(
        map([
          ["type", "spotSend"],
          ["destination", ADDRESS],
          ["token", "PURR:0x01"],
          ["amount", asDecimal("4")],
          ["time", TIME],
        ]),
      ),
    );
  });

  test("spotSend rejects non-positive amount", () => {
    expectPath(
      () => SPOT_SEND.encode({ ...SPOT_SEND_ACTION, amount: asDecimal("0") }),
      "action.amount",
    );
  });

  test("approveAgent valid case is byte-identical", () => {
    expect(bytesOf(APPROVE_AGENT.encode(APPROVE_AGENT_ACTION))).toEqual(
      bytesOf(
        map([
          ["type", "approveAgent"],
          ["agentAddress", ADDRESS],
          ["agentName", "agent"],
          ["nonce", 7],
        ]),
      ),
    );
  });

  test("approveAgent rejects the zero address", () => {
    expectPath(
      () => APPROVE_AGENT.encode({ ...APPROVE_AGENT_ACTION, agentAddress: ZERO }),
      "action.agentAddress",
    );
  });

  test("approveBuilderFee valid case is byte-identical", () => {
    expect(bytesOf(APPROVE_BUILDER_FEE.encode(APPROVE_BUILDER_ACTION))).toEqual(
      bytesOf(
        map([
          ["type", "approveBuilderFee"],
          ["maxFeeRate", "0.01%"],
          ["builder", ADDRESS],
          ["nonce", 7],
        ]),
      ),
    );
  });

  test("approveBuilderFee rejects a fee above the 1% cap and malformed rates", () => {
    expectPath(
      () =>
        APPROVE_BUILDER_FEE.encode({
          ...APPROVE_BUILDER_ACTION,
          maxFeeRate: "1.01%",
        }),
      "action.maxFeeRate",
    );
    expectPath(
      () => APPROVE_BUILDER_FEE.encode({ ...APPROVE_BUILDER_ACTION, maxFeeRate: "0.0001%" }),
      "action.maxFeeRate",
    );
    expectPath(
      () => APPROVE_BUILDER_FEE.encode({ ...APPROVE_BUILDER_ACTION, maxFeeRate: "0.01" }),
      "action.maxFeeRate",
    );
  });

  test("approveBuilderFee accepts the 1% cap boundary", () => {
    const wire = APPROVE_BUILDER_FEE.encode({ ...APPROVE_BUILDER_ACTION, maxFeeRate: "1%" });
    expect(wire[1]).toEqual(["maxFeeRate", "1%"]);
  });

  test("hip3LiquidatorTransfer valid case is byte-identical", () => {
    expect(
      bytesOf(encodeHip3LiquidatorTransfer({ dex: "", ntl: 2_000_000_000, isDeposit: true })),
    ).toEqual(
      bytesOf(
        map([
          ["type", "hip3LiquidatorTransfer"],
          ["dex", ""],
          ["ntl", 2_000_000_000],
          ["isDeposit", true],
        ]),
      ),
    );
  });

  test("hip3LiquidatorTransfer keeps the multiple-of-1e9 rule", () => {
    expectPath(
      () => encodeHip3LiquidatorTransfer({ dex: "", ntl: 1_500_000_000, isDeposit: true }),
      "action.ntl",
    );
    expectPath(
      () => encodeHip3LiquidatorTransfer({ dex: "", ntl: 0, isDeposit: true }),
      "action.ntl",
    );
  });
});
