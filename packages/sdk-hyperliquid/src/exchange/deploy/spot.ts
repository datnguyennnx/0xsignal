/**
 * @hyperliquid-api POST /exchange action "spotDeploy"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/deploying-hip-1-and-hip-2-assets.md
 */

import type { Address, DecimalString } from "../../core/brands";
import { map, type MpMap, type MpValue } from "../../core/msgpack";

export interface SpotRegisterToken2Variant {
  registerToken2: {
    spec: { name: string; szDecimals: number; weiDecimals: number };
    maxGas: number;
    fullName?: string;
  };
}

export interface SpotUserGenesisVariant {
  userGenesis: {
    token: number;
    userAndWei: ReadonlyArray<readonly [Address, DecimalString]>;
    existingTokenAndWei: ReadonlyArray<readonly [number, DecimalString]>;
    blacklistUsers?: ReadonlyArray<readonly [Address, boolean]>;
  };
}

export interface SpotGenesisVariant {
  genesis: { token: number; maxSupply: DecimalString; noHyperliquidity?: true };
}

export interface SpotRegisterSpotVariant {
  registerSpot: { tokens: readonly [number, number] };
}

export interface SpotRegisterHyperliquidityVariant {
  registerHyperliquidity: {
    spot: number;
    startPx: DecimalString;
    orderSz: DecimalString;
    nOrders: number;
    nSeededLevels?: number;
  };
}

export interface SpotSetDeployerTradingFeeShareVariant {
  setDeployerTradingFeeShare: { token: number; share: string };
}

export interface SpotEnableQuoteTokenVariant {
  enableQuoteToken: { token: number };
}

export interface SpotEnableAlignedQuoteTokenVariant {
  enableAlignedQuoteToken: { token: number };
}

export interface SpotDisableQuoteTokenVariant {
  disableQuoteToken: { token: number };
}

export interface SpotDisableAlignedQuoteTokenVariant {
  disableAlignedQuoteToken: { token: number };
}

export interface SpotSetTokenAnnotationVariant {
  setTokenAnnotation: {
    token: number;
    annotation: {
      category: string;
      description: string;
      displayName: string | null;
      keywords: ReadonlyArray<string>;
    };
  };
}

export interface SpotSetDeployerLabelVariant {
  setDeployerLabel: { label: string };
}

export interface SpotEnableFreezePrivilegeVariant {
  enableFreezePrivilege: { token: number };
}

export interface SpotFreezeUserVariant {
  freezeUser: { token: number; user: Address; freeze: boolean };
}

export interface SpotRevokeFreezePrivilegeVariant {
  revokeFreezePrivilege: { token: number };
}

export type SpotDeployVariant =
  | SpotRegisterToken2Variant
  | SpotUserGenesisVariant
  | SpotGenesisVariant
  | SpotRegisterSpotVariant
  | SpotRegisterHyperliquidityVariant
  | SpotSetDeployerTradingFeeShareVariant
  | SpotEnableQuoteTokenVariant
  | SpotEnableAlignedQuoteTokenVariant
  | SpotDisableQuoteTokenVariant
  | SpotDisableAlignedQuoteTokenVariant
  | SpotSetTokenAnnotationVariant
  | SpotSetDeployerLabelVariant
  | SpotEnableFreezePrivilegeVariant
  | SpotFreezeUserVariant
  | SpotRevokeFreezePrivilegeVariant;

export type SpotDeployAction = { type: "spotDeploy" } & SpotDeployVariant;

const pair = ([key, value]: readonly [string | number, MpValue]): MpMap =>
  map([[String(key), value]]);

const encodeSpec = (s: SpotRegisterToken2Variant["registerToken2"]["spec"]): MpMap =>
  map([
    ["name", s.name],
    ["szDecimals", s.szDecimals],
    ["weiDecimals", s.weiDecimals],
  ]);

const encodeAnnotation = (
  annotation: SpotSetTokenAnnotationVariant["setTokenAnnotation"]["annotation"],
): MpMap =>
  map([
    ["category", annotation.category],
    ["description", annotation.description],
    ["displayName", annotation.displayName],
    ["keywords", annotation.keywords],
  ]);

const encodeRegisterToken2 = (value: SpotRegisterToken2Variant["registerToken2"]): MpMap => {
  const m: [string, MpValue][] = [
    ["spec", encodeSpec(value.spec)],
    ["maxGas", value.maxGas],
  ];
  if (value.fullName !== undefined) m.push(["fullName", value.fullName]);
  return map(m);
};

const encodeUserGenesis = (value: SpotUserGenesisVariant["userGenesis"]): MpMap => {
  const m: [string, MpValue][] = [
    ["token", value.token],
    ["userAndWei", value.userAndWei.map(pair)],
    ["existingTokenAndWei", value.existingTokenAndWei.map(pair)],
  ];
  if (value.blacklistUsers !== undefined) {
    m.push(["blacklistUsers", value.blacklistUsers.map(pair)]);
  }
  return map(m);
};

const encodeGenesis = (value: SpotGenesisVariant["genesis"]): MpMap => {
  const m: [string, MpValue][] = [
    ["token", value.token],
    ["maxSupply", value.maxSupply],
  ];
  if (value.noHyperliquidity !== undefined) {
    m.push(["noHyperliquidity", value.noHyperliquidity]);
  }
  return map(m);
};

const encodeRegisterHyperliquidity = (
  value: SpotRegisterHyperliquidityVariant["registerHyperliquidity"],
): MpMap => {
  const m: [string, MpValue][] = [
    ["spot", value.spot],
    ["startPx", value.startPx],
    ["orderSz", value.orderSz],
    ["nOrders", value.nOrders],
  ];
  if (value.nSeededLevels !== undefined) {
    m.push(["nSeededLevels", value.nSeededLevels]);
  }
  return map(m);
};

const encodeToken = (value: { token: number }): MpMap => map([["token", value.token]]);

export function encodeSpotDeploy(action: SpotDeployAction): MpMap {
  if ("registerToken2" in action) {
    return map([
      ["type", "spotDeploy"],
      ["registerToken2", encodeRegisterToken2(action.registerToken2)],
    ]);
  }
  if ("userGenesis" in action) {
    return map([
      ["type", "spotDeploy"],
      ["userGenesis", encodeUserGenesis(action.userGenesis)],
    ]);
  }
  if ("genesis" in action) {
    return map([
      ["type", "spotDeploy"],
      ["genesis", encodeGenesis(action.genesis)],
    ]);
  }
  if ("registerSpot" in action) {
    return map([
      ["type", "spotDeploy"],
      ["registerSpot", map([["tokens", action.registerSpot.tokens]])],
    ]);
  }
  if ("registerHyperliquidity" in action) {
    return map([
      ["type", "spotDeploy"],
      ["registerHyperliquidity", encodeRegisterHyperliquidity(action.registerHyperliquidity)],
    ]);
  }
  if ("setDeployerTradingFeeShare" in action) {
    const value = action.setDeployerTradingFeeShare;
    return map([
      ["type", "spotDeploy"],
      [
        "setDeployerTradingFeeShare",
        map([
          ["token", value.token],
          ["share", value.share],
        ]),
      ],
    ]);
  }
  if ("enableQuoteToken" in action) {
    return map([
      ["type", "spotDeploy"],
      ["enableQuoteToken", encodeToken(action.enableQuoteToken)],
    ]);
  }
  if ("enableAlignedQuoteToken" in action) {
    return map([
      ["type", "spotDeploy"],
      ["enableAlignedQuoteToken", encodeToken(action.enableAlignedQuoteToken)],
    ]);
  }
  if ("disableQuoteToken" in action) {
    return map([
      ["type", "spotDeploy"],
      ["disableQuoteToken", encodeToken(action.disableQuoteToken)],
    ]);
  }
  if ("disableAlignedQuoteToken" in action) {
    return map([
      ["type", "spotDeploy"],
      ["disableAlignedQuoteToken", encodeToken(action.disableAlignedQuoteToken)],
    ]);
  }
  if ("setTokenAnnotation" in action) {
    const value = action.setTokenAnnotation;
    return map([
      ["type", "spotDeploy"],
      [
        "setTokenAnnotation",
        map([
          ["token", value.token],
          ["annotation", encodeAnnotation(value.annotation)],
        ]),
      ],
    ]);
  }
  if ("setDeployerLabel" in action) {
    return map([
      ["type", "spotDeploy"],
      ["setDeployerLabel", map([["label", action.setDeployerLabel.label]])],
    ]);
  }
  if ("enableFreezePrivilege" in action) {
    return map([
      ["type", "spotDeploy"],
      ["enableFreezePrivilege", encodeToken(action.enableFreezePrivilege)],
    ]);
  }
  if ("freezeUser" in action) {
    const value = action.freezeUser;
    return map([
      ["type", "spotDeploy"],
      [
        "freezeUser",
        map([
          ["token", value.token],
          ["user", value.user],
          ["freeze", value.freeze],
        ]),
      ],
    ]);
  }
  return map([
    ["type", "spotDeploy"],
    ["revokeFreezePrivilege", encodeToken(action.revokeFreezePrivilege)],
  ]);
}
