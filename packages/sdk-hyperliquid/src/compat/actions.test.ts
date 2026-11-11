import { describe, expect, test } from "bun:test";
import {
  asAddress,
  asCloid,
  asDecimal,
  type Address,
  type Cloid,
  type WirePx,
  type WireSz,
} from "../core/brands";
import { map, toObject, type MpMap } from "../core/msgpack";
import { cast } from "../core/parse";
import {
  L1_ENCODERS,
  USER_SIGNED,
  type L1ActionName,
  type UserSignedActionType,
} from "../exchange/actions/index";
import type { OrderWire } from "../exchange/actions/order-wire";

const ADDRESS: Address = asAddress("0x1111111111111111111111111111111111111111");
const OTHER: Address = asAddress("0x2222222222222222222222222222222222222222");
const CLOID: Cloid = asCloid("0x0102030405060708090a0b0c0d0e0f10");

const px = (value: string): WirePx => cast<WirePx>(asDecimal(value), "px");
const sz = (value: string): WireSz => cast<WireSz>(asDecimal(value), "sz");

const ORDER: OrderWire = {
  a: 0,
  b: true,
  p: px("100"),
  s: sz("1"),
  r: false,
  t: { limit: { tif: "Gtc" } },
};

const L1_SAMPLES: Record<L1ActionName, unknown> = {
  order: { orders: [ORDER], grouping: "na" },
  cancel: { cancels: [{ a: 0, o: 1 }] },
  cancelByCloid: { cancels: [{ asset: 0, cloid: CLOID }] },
  modify: { oid: 1, order: ORDER },
  batchModify: { modifies: [{ oid: 1, order: ORDER }] },
  scheduleCancel: { time: 1_700_000_000_000 },
  updateLeverage: { asset: 0, isCross: true, leverage: 10 },
  updateIsolatedMargin: { asset: 0, isBuy: true, ntli: 100 },
  topUpIsolatedOnlyMargin: { asset: 0, leverage: asDecimal("10") },
  twapOrder: { twap: { a: 0, b: true, s: sz("1"), r: false, m: 10, t: true } },
  twapCancel: { a: 0, t: 1 },
  noop: {},
  setReferrer: { type: "setReferrer", code: "CODE" },
  createSubAccount: { type: "createSubAccount", name: "sub" },
  subAccountTransfer: {
    type: "subAccountTransfer",
    subAccountUser: ADDRESS,
    isDeposit: true,
    usd: 1,
  },
  subAccountSpotTransfer: {
    type: "subAccountSpotTransfer",
    subAccountUser: ADDRESS,
    isDeposit: true,
    token: "USDC",
    amount: asDecimal("1"),
  },
  vaultTransfer: {
    type: "vaultTransfer",
    vaultAddress: ADDRESS,
    isDeposit: true,
    usd: 1,
  },
  evmUserModify: { type: "evmUserModify", usingBigBlocks: true },
  agentEnableDexAbstraction: { type: "agentEnableDexAbstraction" },
  agentSetAbstraction: { type: "agentSetAbstraction", abstraction: "u" },
  agentSendAsset: {
    type: "agentSendAsset",
    destination: ADDRESS,
    sourceDex: "",
    destinationDex: "",
    token: 0,
    amount: asDecimal("1"),
    fromSubAccount: false,
    nonce: 1,
  },
  multiSig: {
    type: "multiSig",
    signatureChainId: "0xa4b1",
    signatures: [{ r: "0x01", s: "0x02", v: 27 }],
    payload: { multiSigUser: ADDRESS, outerSigner: OTHER, action: map([["type", "noop"]]) },
  },
  userOutcome: { type: "userOutcome", splitOutcome: { outcome: 0, amount: asDecimal("1") } },
  trailingStop: {
    asset: 0,
    isBuy: true,
    sz: asDecimal("1"),
    reduceOnly: false,
    retracement: { pct: "5" },
    activationPx: null,
  },
  reserveRequestWeight: { weight: 1 },
  cDeposit2: { wei: 1 },
  hip3LiquidatorTransfer: { dex: "", ntl: 1_000_000_000, isDeposit: true },
  spotDeploy: { type: "spotDeploy", registerSpot: { tokens: [0, 1] } },
  perpDeploy: { type: "perpDeploy", disableDex: "dex" },
  outcomeDeploy: { type: "outcomeDeploy", venue: "venue", setSubDeployers: [] },
  activateOutcomeDeployer: { type: "activateOutcomeDeployer", deactivate: null },
};

const L1_KEYS: Record<L1ActionName, readonly string[]> = {
  order: ["type", "orders", "grouping"],
  cancel: ["type", "cancels"],
  cancelByCloid: ["type", "cancels"],
  modify: ["type", "oid", "order"],
  batchModify: ["type", "modifies"],
  scheduleCancel: ["type", "time"],
  updateLeverage: ["type", "asset", "isCross", "leverage"],
  updateIsolatedMargin: ["type", "asset", "isBuy", "ntli"],
  topUpIsolatedOnlyMargin: ["type", "asset", "leverage"],
  twapOrder: ["type", "twap"],
  twapCancel: ["type", "a", "t"],
  noop: ["type"],
  setReferrer: ["type", "code"],
  createSubAccount: ["type", "name"],
  subAccountTransfer: ["type", "subAccountUser", "isDeposit", "usd"],
  subAccountSpotTransfer: ["type", "subAccountUser", "isDeposit", "token", "amount"],
  vaultTransfer: ["type", "vaultAddress", "isDeposit", "usd"],
  evmUserModify: ["type", "usingBigBlocks"],
  agentEnableDexAbstraction: ["type"],
  agentSetAbstraction: ["type", "abstraction"],
  agentSendAsset: [
    "type",
    "destination",
    "sourceDex",
    "destinationDex",
    "token",
    "amount",
    "fromSubAccount",
    "nonce",
  ],
  multiSig: ["type", "signatureChainId", "signatures", "payload"],
  userOutcome: ["type", "splitOutcome"],
  trailingStop: ["type", "asset", "isBuy", "sz", "reduceOnly", "retracement", "activationPx"],
  reserveRequestWeight: ["type", "weight"],
  cDeposit2: ["type", "wei"],
  hip3LiquidatorTransfer: ["type", "dex", "ntl", "isDeposit"],
  spotDeploy: ["type", "registerSpot"],
  perpDeploy: ["type", "disableDex"],
  outcomeDeploy: ["type", "setSubDeployers"],
  activateOutcomeDeployer: ["type", "deactivate"],
};

const encodeL1 = (name: L1ActionName): ((action: unknown) => MpMap) =>
  cast<(action: unknown) => MpMap>(L1_ENCODERS[name], name);

const isL1ActionName = (name: string): name is L1ActionName =>
  Object.prototype.hasOwnProperty.call(L1_ENCODERS, name);

const l1Names = Object.keys(L1_ENCODERS).filter((name) => isL1ActionName(name));

describe("L1 action wire surface", () => {
  test("L1_ENCODERS exposes 31 actions", () => {
    expect(l1Names.length).toBe(31);
  });

  for (const name of l1Names) {
    test(`${name}: type first and documented key order`, () => {
      const wire = toObject(encodeL1(name)(L1_SAMPLES[name]));
      const keys = Object.keys(wire);
      expect(keys[0]).toBe("type");
      expect(wire["type"]).toBe(name);
      expect(keys).toEqual([...L1_KEYS[name]]);
    });
  }

  test("optional f and a flags are absent when unset", () => {
    for (const name of ["cancel", "cancelByCloid"] as const) {
      const wire = toObject(encodeL1(name)(L1_SAMPLES[name]));
      expect(Object.prototype.hasOwnProperty.call(wire, "f")).toBe(false);
    }
    for (const name of ["modify", "batchModify"] as const) {
      const wire = toObject(encodeL1(name)(L1_SAMPLES[name]));
      expect(Object.prototype.hasOwnProperty.call(wire, "a")).toBe(false);
    }
  });
});

type UserSignedCase = {
  readonly sample: unknown;
  readonly keys: readonly string[];
  readonly typePrefix: string;
  readonly fieldCount: number;
};

const USER_SIGNED_CASES: Record<UserSignedActionType, UserSignedCase> = {
  approveAgent: {
    sample: {
      agentAddress: ADDRESS,
      agentName: "agent",
      nonce: 1,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    },
    keys: ["type", "agentAddress", "agentName", "nonce"],
    typePrefix: "Approve",
    fieldCount: 4,
  },
  approveBuilderFee: {
    sample: {
      maxFeeRate: "0.01%",
      builder: ADDRESS,
      nonce: 1,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    },
    keys: ["type", "maxFeeRate", "builder", "nonce"],
    typePrefix: "Approve",
    fieldCount: 4,
  },
  usdClassTransfer: {
    sample: {
      amount: asDecimal("100"),
      toPerp: true,
      nonce: 1,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    },
    keys: ["type", "amount", "toPerp", "nonce"],
    typePrefix: "Usd",
    fieldCount: 4,
  },
  sendAsset: {
    sample: {
      destination: ADDRESS,
      sourceDex: "",
      destinationDex: "",
      token: 0,
      amount: asDecimal("1"),
      fromSubAccount: false,
      nonce: 1,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    },
    keys: [
      "type",
      "destination",
      "sourceDex",
      "destinationDex",
      "token",
      "amount",
      "fromSubAccount",
      "nonce",
    ],
    typePrefix: "Send",
    fieldCount: 8,
  },
  sendToEvmWithData: {
    sample: {
      hyperliquidChain: "Mainnet",
      token: "USDC",
      amount: asDecimal("1"),
      sourceDex: "",
      destinationRecipient: ADDRESS,
      addressEncoding: "hex",
      destinationChainId: 1,
      gasLimit: 1,
      data: "0x",
      nonce: 1,
      signatureChainId: "0xa4b1",
    },
    keys: [
      "type",
      "hyperliquidChain",
      "token",
      "amount",
      "sourceDex",
      "destinationRecipient",
      "addressEncoding",
      "destinationChainId",
      "gasLimit",
      "data",
      "nonce",
    ],
    typePrefix: "Send",
    fieldCount: 10,
  },
  usdSend: {
    sample: {
      destination: ADDRESS,
      amount: asDecimal("1"),
      time: 1,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    },
    keys: ["type", "destination", "amount", "time"],
    typePrefix: "Usd",
    fieldCount: 4,
  },
  spotSend: {
    sample: {
      destination: ADDRESS,
      token: "USDC",
      amount: asDecimal("1"),
      time: 1,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    },
    keys: ["type", "destination", "token", "amount", "time"],
    typePrefix: "Spot",
    fieldCount: 5,
  },
  withdraw3: {
    sample: {
      destination: ADDRESS,
      amount: asDecimal("1"),
      time: 1,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    },
    keys: ["type", "signatureChainId", "hyperliquidChain", "destination", "amount", "time"],
    typePrefix: "Withdraw",
    fieldCount: 4,
  },
  convertToMultiSigUser: {
    sample: {
      signers: "[]",
      nonce: 1,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    },
    keys: ["type", "signers", "nonce"],
    typePrefix: "Convert",
    fieldCount: 3,
  },
  tokenDelegate: {
    sample: {
      validator: ADDRESS,
      wei: 1,
      isUndelegate: false,
      nonce: 1,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    },
    keys: ["type", "validator", "wei", "isUndelegate", "nonce"],
    typePrefix: "Token",
    fieldCount: 5,
  },
  userDexAbstraction: {
    sample: {
      user: ADDRESS,
      enabled: true,
      nonce: 1,
      hyperliquidChain: "Mainnet",
      signatureChainId: "0xa4b1",
    },
    keys: ["type", "user", "enabled", "nonce"],
    typePrefix: "User",
    fieldCount: 4,
  },
  userSetAbstraction: {
    sample: { user: ADDRESS, abstraction: "disabled", nonce: 1 },
    keys: ["type", "user", "abstraction", "nonce"],
    typePrefix: "User",
    fieldCount: 4,
  },
  cDeposit: {
    sample: { wei: 1, nonce: 1 },
    keys: ["type", "wei", "nonce"],
    typePrefix: "CDeposit",
    fieldCount: 3,
  },
  cWithdraw: {
    sample: { wei: 1, nonce: 1 },
    keys: ["type", "wei", "nonce"],
    typePrefix: "CWithdraw",
    fieldCount: 3,
  },
};

const isUserSignedActionType = (name: string): name is UserSignedActionType =>
  Object.prototype.hasOwnProperty.call(USER_SIGNED, name);

const userSignedNames = Object.keys(USER_SIGNED).filter((name) => isUserSignedActionType(name));

describe("user-signed action wire surface", () => {
  test("USER_SIGNED exposes 14 actions", () => {
    expect(userSignedNames.length).toBe(14);
  });

  for (const name of userSignedNames) {
    test(`${name}: type first and documented key order`, () => {
      const descriptor = USER_SIGNED[name];
      const expected = USER_SIGNED_CASES[name];
      const encode = cast<(action: unknown) => MpMap>(descriptor.encode, name);
      const wire = toObject(encode(expected.sample));
      const keys = Object.keys(wire);
      expect(keys[0]).toBe("type");
      expect(wire["type"]).toBe(name);
      expect(keys).toEqual([...expected.keys]);
      expect(descriptor.typeName.startsWith(expected.typePrefix)).toBe(true);
      expect(descriptor.fieldTypes.length).toBe(expected.fieldCount);
    });
  }
});
