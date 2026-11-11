/**
 * @hyperliquid-api POST /exchange action "userOutcome"
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import type { DecimalString } from "../../core/brands";
import { map, type MpMap } from "../../core/msgpack";

export const USER_OUTCOME_TYPE = "userOutcome" as const;

type UserOutcomeOf<T> = { readonly type: typeof USER_OUTCOME_TYPE } & T;

export type SplitOutcomeAction = UserOutcomeOf<{
  readonly splitOutcome: {
    readonly outcome: number;
    readonly amount: DecimalString;
  };
}>;

export type MergeOutcomeAction = UserOutcomeOf<{
  readonly mergeOutcome: {
    readonly outcome: number;
    readonly amount: DecimalString | null;
  };
}>;

export type MergeQuestionAction = UserOutcomeOf<{
  readonly mergeQuestion: {
    readonly question: number;
    readonly amount: DecimalString | null;
  };
}>;

export type NegateOutcomeAction = UserOutcomeOf<{
  readonly negateOutcome: {
    readonly question: number;
    readonly outcome: number;
    readonly amount: DecimalString;
  };
}>;

export type UserOutcomeAction =
  | SplitOutcomeAction
  | MergeOutcomeAction
  | MergeQuestionAction
  | NegateOutcomeAction;

export function encodeUserOutcome(action: UserOutcomeAction): MpMap {
  if ("splitOutcome" in action) {
    const v = action.splitOutcome;
    return map([
      ["type", USER_OUTCOME_TYPE],
      [
        "splitOutcome",
        map([
          ["outcome", v.outcome],
          ["amount", v.amount],
        ]),
      ],
    ]);
  }
  if ("mergeOutcome" in action) {
    const v = action.mergeOutcome;
    return map([
      ["type", USER_OUTCOME_TYPE],
      [
        "mergeOutcome",
        map([
          ["outcome", v.outcome],
          ["amount", v.amount],
        ]),
      ],
    ]);
  }
  if ("mergeQuestion" in action) {
    const v = action.mergeQuestion;
    return map([
      ["type", USER_OUTCOME_TYPE],
      [
        "mergeQuestion",
        map([
          ["question", v.question],
          ["amount", v.amount],
        ]),
      ],
    ]);
  }
  const v = action.negateOutcome;
  return map([
    ["type", USER_OUTCOME_TYPE],
    [
      "negateOutcome",
      map([
        ["question", v.question],
        ["outcome", v.outcome],
        ["amount", v.amount],
      ]),
    ],
  ]);
}
