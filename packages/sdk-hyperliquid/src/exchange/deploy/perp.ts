/**
 * @hyperliquid-api POST /exchange action "perpDeploy"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/hip-3-deployer-actions.md
 */

import type { Address, DecimalString } from "../../core/brands";
import { map, type MpMap, type MpValue } from "../../core/msgpack";

export interface PerpDexSchemaInput {
  fullName: string;
  collateralToken: number;
  oracleUpdater?: Address;
  isStar?: boolean;
}

export interface PerpRegisterAsset2Variant {
  registerAsset2: {
    maxGas?: number;
    assetRequest: {
      coin: string;
      szDecimals: number;
      oraclePx: DecimalString;
      marginTableId: number;
      marginMode: "strictIsolated" | "noCross" | "normal";
    };
    dex: string;
    schema?: PerpDexSchemaInput;
  };
}

export interface PerpRegisterAssetVariant {
  registerAsset: {
    maxGas?: number;
    assetRequest: {
      coin: string;
      szDecimals: number;
      oraclePx: DecimalString;
      marginTableId: number;
      onlyIsolated: boolean;
    };
    dex: string;
    schema?: PerpDexSchemaInput;
  };
}

export interface PerpSetOracleVariant {
  setOracle: {
    dex: string;
    oraclePxs: ReadonlyArray<readonly [string, DecimalString]>;
    markPxs: ReadonlyArray<ReadonlyArray<readonly [string, DecimalString]>>;
    externalPerpPxs: ReadonlyArray<readonly [string, DecimalString]>;
  };
}

export interface PerpSetFundingMultipliersVariant {
  setFundingMultipliers: ReadonlyArray<readonly [string, DecimalString]>;
}

export interface PerpSetFundingInterestRatesVariant {
  setFundingInterestRates: ReadonlyArray<readonly [string, DecimalString]>;
}

export interface PerpSetFundingClampsVariant {
  setFundingClamps: ReadonlyArray<readonly [string, DecimalString]>;
}

export interface PerpHaltTradingVariant {
  haltTrading: { coin: string; isHalted: boolean };
}

export interface PerpInsertMarginTableVariant {
  insertMarginTable: {
    dex: string;
    marginTable: {
      description: string;
      marginTiers: ReadonlyArray<{ lowerBound: number; maxLeverage: number }>;
    };
  };
}

export interface PerpSetMarginTableIdsVariant {
  setMarginTableIds: ReadonlyArray<readonly [string, number]>;
}

export interface PerpSetOpenInterestCapsVariant {
  setOpenInterestCaps: ReadonlyArray<readonly [string, number | null]>;
}

export interface PerpSetMarginModesVariant {
  setMarginModes: ReadonlyArray<readonly [string, "strictIsolated" | "noCross" | "normal"]>;
}

export interface PerpSetDeployerFeesVariant {
  setDeployerFees: ReadonlyArray<readonly [string, { scale: DecimalString; growthMode: boolean }]>;
}

export interface PerpSetFeeRecipientVariant {
  setFeeRecipient: { dex: string; feeRecipient: Address };
}

export interface PerpSetSubDeployersVariant {
  setSubDeployers: {
    dex: string;
    subDeployers: ReadonlyArray<{
      variant: string;
      user: Address;
      allowed: boolean;
    }>;
  };
}

export interface PerpSetPerpAnnotationVariant {
  setPerpAnnotation: {
    coin: string;
    category: string;
    description: string;
    displayName: string | null;
    keywords: ReadonlyArray<string>;
  };
}

export interface PerpDisableDexVariant {
  disableDex: string;
}

export interface PerpStarVariant {
  star: {
    dex: string;
    operation:
      | { proxy: readonly [Address, string] }
      | { setOracle: { oraclePxs: ReadonlyArray<readonly [string, DecimalString]> } };
  };
}

export type PerpDeployVariant =
  | PerpRegisterAsset2Variant
  | PerpRegisterAssetVariant
  | PerpSetOracleVariant
  | PerpSetFundingMultipliersVariant
  | PerpSetFundingInterestRatesVariant
  | PerpSetFundingClampsVariant
  | PerpHaltTradingVariant
  | PerpInsertMarginTableVariant
  | PerpSetMarginTableIdsVariant
  | PerpSetOpenInterestCapsVariant
  | PerpSetMarginModesVariant
  | PerpSetDeployerFeesVariant
  | PerpSetFeeRecipientVariant
  | PerpSetSubDeployersVariant
  | PerpSetPerpAnnotationVariant
  | PerpDisableDexVariant
  | PerpStarVariant;

export type PerpDeployAction = { type: "perpDeploy" } & PerpDeployVariant;

const pair = ([key, value]: readonly [string | number, MpValue]): MpMap =>
  map([[String(key), value]]);

const encodeSchema = (s: PerpDexSchemaInput): MpMap => {
  const m: [string, MpValue][] = [
    ["fullName", s.fullName],
    ["collateralToken", s.collateralToken],
  ];
  if (s.oracleUpdater !== undefined) m.push(["oracleUpdater", s.oracleUpdater]);
  if (s.isStar === true) m.push(["isStar", true]);
  return map(m);
};

const encodeAssetRequest = (
  r: PerpRegisterAsset2Variant["registerAsset2"]["assetRequest"],
): MpMap =>
  map([
    ["coin", r.coin],
    ["szDecimals", r.szDecimals],
    ["oraclePx", r.oraclePx],
    ["marginTableId", r.marginTableId],
    ["marginMode", r.marginMode],
  ]);

const encodeLegacyAssetRequest = (
  r: PerpRegisterAssetVariant["registerAsset"]["assetRequest"],
): MpMap =>
  map([
    ["coin", r.coin],
    ["szDecimals", r.szDecimals],
    ["oraclePx", r.oraclePx],
    ["marginTableId", r.marginTableId],
    ["onlyIsolated", r.onlyIsolated],
  ]);

const encodeRegisterAsset2 = (value: PerpRegisterAsset2Variant["registerAsset2"]): MpMap => {
  const m: [string, MpValue][] = [];
  if (value.maxGas !== undefined) m.push(["maxGas", value.maxGas]);
  m.push(["assetRequest", encodeAssetRequest(value.assetRequest)], ["dex", value.dex]);
  if (value.schema !== undefined) m.push(["schema", encodeSchema(value.schema)]);
  return map(m);
};

const encodeRegisterAsset = (value: PerpRegisterAssetVariant["registerAsset"]): MpMap => {
  const m: [string, MpValue][] = [];
  if (value.maxGas !== undefined) m.push(["maxGas", value.maxGas]);
  m.push(["assetRequest", encodeLegacyAssetRequest(value.assetRequest)], ["dex", value.dex]);
  if (value.schema !== undefined) m.push(["schema", encodeSchema(value.schema)]);
  return map(m);
};

const encodeMarginTier = (t: { lowerBound: number; maxLeverage: number }): MpMap =>
  map([
    ["lowerBound", t.lowerBound],
    ["maxLeverage", t.maxLeverage],
  ]);

const encodeMarginTable = (
  t: PerpInsertMarginTableVariant["insertMarginTable"]["marginTable"],
): MpMap =>
  map([
    ["description", t.description],
    ["marginTiers", t.marginTiers.map(encodeMarginTier)],
  ]);

const encodeDeployerFee = ({
  scale,
  growthMode,
}: {
  scale: DecimalString;
  growthMode: boolean;
}): MpMap =>
  map([
    ["scale", scale],
    ["growthMode", growthMode],
  ]);

const encodeFeePair = ([coin, fee]: readonly [
  string,
  { scale: DecimalString; growthMode: boolean },
]): MpMap => map([[coin, encodeDeployerFee(fee)]]);

const encodeSubDeployer = (s: { variant: string; user: Address; allowed: boolean }): MpMap =>
  map([
    ["variant", s.variant],
    ["user", s.user],
    ["allowed", s.allowed],
  ]);

const encodeStarOperation = (o: PerpStarVariant["star"]["operation"]): MpMap => {
  if ("proxy" in o) return map([["proxy", o.proxy]]);
  return map([["setOracle", map([["oraclePxs", o.setOracle.oraclePxs.map(pair)]])]]);
};

export function encodePerpDeploy(action: PerpDeployAction): MpMap {
  if ("registerAsset2" in action) {
    return map([
      ["type", "perpDeploy"],
      ["registerAsset2", encodeRegisterAsset2(action.registerAsset2)],
    ]);
  }
  if ("registerAsset" in action) {
    return map([
      ["type", "perpDeploy"],
      ["registerAsset", encodeRegisterAsset(action.registerAsset)],
    ]);
  }
  if ("setOracle" in action) {
    const value = action.setOracle;
    return map([
      ["type", "perpDeploy"],
      [
        "setOracle",
        map([
          ["dex", value.dex],
          ["oraclePxs", value.oraclePxs.map(pair)],
          ["markPxs", value.markPxs.map((level) => level.map((entry) => pair(entry)))],
          ["externalPerpPxs", value.externalPerpPxs.map(pair)],
        ]),
      ],
    ]);
  }
  if ("setFundingMultipliers" in action) {
    return map([
      ["type", "perpDeploy"],
      ["setFundingMultipliers", action.setFundingMultipliers.map(pair)],
    ]);
  }
  if ("setFundingInterestRates" in action) {
    return map([
      ["type", "perpDeploy"],
      ["setFundingInterestRates", action.setFundingInterestRates.map(pair)],
    ]);
  }
  if ("setFundingClamps" in action) {
    return map([
      ["type", "perpDeploy"],
      ["setFundingClamps", action.setFundingClamps.map(pair)],
    ]);
  }
  if ("haltTrading" in action) {
    const value = action.haltTrading;
    return map([
      ["type", "perpDeploy"],
      [
        "haltTrading",
        map([
          ["coin", value.coin],
          ["isHalted", value.isHalted],
        ]),
      ],
    ]);
  }
  if ("insertMarginTable" in action) {
    const value = action.insertMarginTable;
    return map([
      ["type", "perpDeploy"],
      [
        "insertMarginTable",
        map([
          ["dex", value.dex],
          ["marginTable", encodeMarginTable(value.marginTable)],
        ]),
      ],
    ]);
  }
  if ("setMarginTableIds" in action) {
    return map([
      ["type", "perpDeploy"],
      ["setMarginTableIds", action.setMarginTableIds.map(pair)],
    ]);
  }
  if ("setOpenInterestCaps" in action) {
    return map([
      ["type", "perpDeploy"],
      ["setOpenInterestCaps", action.setOpenInterestCaps.map(pair)],
    ]);
  }
  if ("setMarginModes" in action) {
    return map([
      ["type", "perpDeploy"],
      ["setMarginModes", action.setMarginModes.map(pair)],
    ]);
  }
  if ("setDeployerFees" in action) {
    return map([
      ["type", "perpDeploy"],
      ["setDeployerFees", action.setDeployerFees.map(encodeFeePair)],
    ]);
  }
  if ("setFeeRecipient" in action) {
    const value = action.setFeeRecipient;
    return map([
      ["type", "perpDeploy"],
      [
        "setFeeRecipient",
        map([
          ["dex", value.dex],
          ["feeRecipient", value.feeRecipient],
        ]),
      ],
    ]);
  }
  if ("setSubDeployers" in action) {
    const value = action.setSubDeployers;
    return map([
      ["type", "perpDeploy"],
      [
        "setSubDeployers",
        map([
          ["dex", value.dex],
          ["subDeployers", value.subDeployers.map(encodeSubDeployer)],
        ]),
      ],
    ]);
  }
  if ("setPerpAnnotation" in action) {
    const value = action.setPerpAnnotation;
    return map([
      ["type", "perpDeploy"],
      [
        "setPerpAnnotation",
        map([
          ["coin", value.coin],
          ["category", value.category],
          ["description", value.description],
          ["displayName", value.displayName],
          ["keywords", value.keywords],
        ]),
      ],
    ]);
  }
  if ("disableDex" in action) {
    return map([
      ["type", "perpDeploy"],
      ["disableDex", action.disableDex],
    ]);
  }
  const value = action.star;
  return map([
    ["type", "perpDeploy"],
    [
      "star",
      map([
        ["dex", value.dex],
        ["operation", encodeStarOperation(value.operation)],
      ]),
    ],
  ]);
}
