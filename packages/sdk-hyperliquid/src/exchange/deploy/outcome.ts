/**
 * @hyperliquid-api POST /exchange actions "activateOutcomeDeployer", "outcomeDeploy"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/hip-4-deployer-actions.md
 */

import type { Address, DecimalString } from "../../core/brands";
import { map, type MpMap, type MpValue } from "../../core/msgpack";

export type ActivateOutcomeDeployerAction =
  | { type: "activateOutcomeDeployer"; activate: { venueName: string } }
  | { type: "activateOutcomeDeployer"; deactivate: null };

export interface OutcomeRegisterStandaloneOutcomeFromTemplateVariant {
  registerStandaloneOutcomeFromTemplate: {
    id: string;
    keywordToValue: ReadonlyArray<readonly [string, string]>;
    deployerFeeScale: DecimalString;
  };
}

export interface OutcomeRegisterQuestionFromTemplateVariant {
  registerQuestionFromTemplate: {
    questionTemplateInstance: {
      id: string;
      keywordToValue: ReadonlyArray<readonly [string, string]>;
      deployerFeeScale: DecimalString;
    };
    namedOutcomeTemplateInstances: ReadonlyArray<{
      id: string;
      keywordToValue: ReadonlyArray<readonly [string, string]>;
    }>;
  };
}

export interface OutcomeRegisterAndAssociateNamedOutcomeFromTemplateVariant {
  registerAndAssociateNamedOutcomeFromTemplate: {
    question: number;
    namedOutcomeTemplateInstance: {
      id: string;
      keywordToValue: ReadonlyArray<readonly [string, string]>;
    };
  };
}

export interface OutcomeSettleOutcomeVariant {
  settleOutcome: {
    outcome: number;
    settleFraction: DecimalString;
    details: "";
    nameAndDescription: readonly [string, string];
    sideNames: readonly [string, string];
  };
}

export interface OutcomeSettleQuestion2Variant {
  settleQuestion2: {
    question: number;
    outcomeSettlements: ReadonlyArray<{
      outcome: number;
      settleFraction: DecimalString;
      details: "";
      nameAndDescription: readonly [string, string];
      sideNames: readonly [string, string];
    }>;
    nameAndDescription: readonly [string, string];
  };
}

export interface OutcomeSetSubDeployersVariant {
  setSubDeployers: ReadonlyArray<{
    variant: string;
    user: Address;
    allowed: boolean;
  }>;
}

export type OutcomeDeployVariant =
  | OutcomeRegisterStandaloneOutcomeFromTemplateVariant
  | OutcomeRegisterQuestionFromTemplateVariant
  | OutcomeRegisterAndAssociateNamedOutcomeFromTemplateVariant
  | OutcomeSettleOutcomeVariant
  | OutcomeSettleQuestion2Variant
  | OutcomeSetSubDeployersVariant;

export type OutcomeDeployAction = { type: "outcomeDeploy"; venue: string } & OutcomeDeployVariant;

const pair = ([key, value]: readonly [string | number, MpValue]): MpMap =>
  map([[String(key), value]]);

const encodeKeywordToValue = (items: ReadonlyArray<readonly [string, string]>): MpMap[] =>
  items.map((item) => pair(item));

const encodeTemplateInstance = (i: {
  id: string;
  keywordToValue: ReadonlyArray<readonly [string, string]>;
}): MpMap =>
  map([
    ["id", i.id],
    ["keywordToValue", encodeKeywordToValue(i.keywordToValue)],
  ]);

const encodeSubDeployer = (s: { variant: string; user: Address; allowed: boolean }): MpMap =>
  map([
    ["variant", s.variant],
    ["user", s.user],
    ["allowed", s.allowed],
  ]);

const encodeSettlement = (s: {
  outcome: number;
  settleFraction: DecimalString;
  details: "";
  nameAndDescription: readonly [string, string];
  sideNames: readonly [string, string];
}): MpMap =>
  map([
    ["outcome", s.outcome],
    ["settleFraction", s.settleFraction],
    ["details", s.details],
    ["nameAndDescription", s.nameAndDescription],
    ["sideNames", s.sideNames],
  ]);

export function encodeOutcomeDeploy(action: OutcomeDeployAction): MpMap {
  if ("registerStandaloneOutcomeFromTemplate" in action) {
    const value = action.registerStandaloneOutcomeFromTemplate;
    return map([
      ["type", "outcomeDeploy"],
      [
        "registerStandaloneOutcomeFromTemplate",
        map([
          ["id", value.id],
          ["keywordToValue", encodeKeywordToValue(value.keywordToValue)],
          ["deployerFeeScale", value.deployerFeeScale],
        ]),
      ],
    ]);
  }
  if ("registerQuestionFromTemplate" in action) {
    const value = action.registerQuestionFromTemplate;
    return map([
      ["type", "outcomeDeploy"],
      [
        "registerQuestionFromTemplate",
        map([
          ["questionTemplateInstance", encodeTemplateInstance(value.questionTemplateInstance)],
          [
            "namedOutcomeTemplateInstances",
            value.namedOutcomeTemplateInstances.map(encodeTemplateInstance),
          ],
        ]),
      ],
    ]);
  }
  if ("registerAndAssociateNamedOutcomeFromTemplate" in action) {
    const value = action.registerAndAssociateNamedOutcomeFromTemplate;
    return map([
      ["type", "outcomeDeploy"],
      [
        "registerAndAssociateNamedOutcomeFromTemplate",
        map([
          ["question", value.question],
          [
            "namedOutcomeTemplateInstance",
            encodeTemplateInstance(value.namedOutcomeTemplateInstance),
          ],
        ]),
      ],
    ]);
  }
  if ("settleOutcome" in action) {
    return map([
      ["type", "outcomeDeploy"],
      ["settleOutcome", encodeSettlement(action.settleOutcome)],
    ]);
  }
  if ("settleQuestion2" in action) {
    const value = action.settleQuestion2;
    return map([
      ["type", "outcomeDeploy"],
      [
        "settleQuestion2",
        map([
          ["question", value.question],
          ["outcomeSettlements", value.outcomeSettlements.map(encodeSettlement)],
          ["nameAndDescription", value.nameAndDescription],
        ]),
      ],
    ]);
  }
  return map([
    ["type", "outcomeDeploy"],
    ["setSubDeployers", action.setSubDeployers.map(encodeSubDeployer)],
  ]);
}

export function encodeActivateOutcomeDeployer(action: ActivateOutcomeDeployerAction): MpMap {
  if ("activate" in action) {
    return map([
      ["type", "activateOutcomeDeployer"],
      ["activate", map([["venueName", action.activate.venueName]])],
    ]);
  }
  return map([
    ["type", "activateOutcomeDeployer"],
    ["deactivate", null],
  ]);
}
