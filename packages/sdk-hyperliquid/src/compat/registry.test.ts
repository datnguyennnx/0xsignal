import { describe, expect, test } from "bun:test";
import { L1_ENCODERS, USER_SIGNED } from "../exchange/actions/index";

const DOCUMENTED_ACTIONS = [
  "order",
  "cancel",
  "cancelByCloid",
  "modify",
  "batchModify",
  "scheduleCancel",
  "updateLeverage",
  "updateIsolatedMargin",
  "topUpIsolatedOnlyMargin",
  "twapOrder",
  "twapCancel",
  "noop",
  "setReferrer",
  "createSubAccount",
  "subAccountTransfer",
  "subAccountSpotTransfer",
  "vaultTransfer",
  "evmUserModify",
  "agentEnableDexAbstraction",
  "agentSetAbstraction",
  "agentSendAsset",
  "multiSig",
  "trailingStop",
  "cDeposit2",
  "approveAgent",
  "approveBuilderFee",
  "usdClassTransfer",
  "sendAsset",
  "sendToEvmWithData",
  "usdSend",
  "spotSend",
  "withdraw3",
  "convertToMultiSigUser",
  "tokenDelegate",
  "userDexAbstraction",
  "userSetAbstraction",
  "cDeposit",
  "cWithdraw",
] as const;

const KNOWN_EXTRAS = [
  "activateOutcomeDeployer",
  "hip3LiquidatorTransfer",
  "outcomeDeploy",
  "perpDeploy",
  "reserveRequestWeight",
  "spotDeploy",
  "userOutcome",
];

const isUserSignedActionType = (name: string): name is keyof typeof USER_SIGNED =>
  Object.prototype.hasOwnProperty.call(USER_SIGNED, name);

const l1Names = Object.keys(L1_ENCODERS);
const userSignedNames = Object.keys(USER_SIGNED).filter((name) => isUserSignedActionType(name));
const union = new Set([...l1Names, ...userSignedNames]);

describe("action registry surface", () => {
  test("L1_ENCODERS has 31 entries", () => {
    expect(l1Names.length).toBe(31);
  });

  test("USER_SIGNED has 14 entries", () => {
    expect(userSignedNames.length).toBe(14);
  });

  test("no action name appears in both registries", () => {
    const overlap = l1Names.filter((name) =>
      Object.prototype.hasOwnProperty.call(USER_SIGNED, name),
    );
    expect(overlap).toEqual([]);
  });

  test("every user-signed descriptor declares field types", () => {
    for (const name of userSignedNames) {
      expect(USER_SIGNED[name].fieldTypes.length).toBeGreaterThan(0);
    }
  });

  test("the registry union covers all 38 documented action types", () => {
    const missing = DOCUMENTED_ACTIONS.filter((name) => !union.has(name));
    expect(missing, `missing documented actions: ${missing.join(", ")}`).toEqual([]);
  });

  test("the union diff reports only the known extras beyond the documented 38", () => {
    const documented = new Set<string>(DOCUMENTED_ACTIONS);
    const extras = [...union].filter((name) => !documented.has(name)).sort();
    expect(extras, `extras beyond the documented 38: ${extras.join(", ")}`).toEqual(KNOWN_EXTRAS);
  });
});
