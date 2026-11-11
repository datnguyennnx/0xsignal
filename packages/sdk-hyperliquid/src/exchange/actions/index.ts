/**
 * @hyperliquid-api POST /exchange (action registry)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import type { MpMap } from "../../core/msgpack";
import type { Eip712FieldType } from "../../core/eip712";
import { cast } from "../../core/parse";
import { encodeOrder } from "./order";
import { encodeCancel } from "./cancel";
import { encodeCancelByCloid } from "./cancel-by-cloid";
import { encodeModify } from "./modify";
import { encodeBatchModify } from "./batch-modify";
import { encodeScheduleCancel } from "./schedule-cancel";
import { encodeUpdateLeverage } from "./update-leverage";
import { encodeUpdateIsolatedMargin } from "./update-isolated-margin";
import { encodeTopUpIsolatedOnlyMargin } from "./top-up-isolated-only-margin";
import { encodeTwapOrder } from "./twap-order";
import { encodeTwapCancel } from "./twap-cancel";
import { encodeNoop } from "./noop";
import { encodeSetReferrer } from "./set-referrer";
import { encodeCreateSubAccount } from "./create-sub-account";
import { encodeSubAccountTransfer } from "./sub-account-transfer";
import { encodeSubAccountSpotTransfer } from "./sub-account-spot-transfer";
import { encodeVaultTransfer } from "./vault-transfer";
import { encodeEvmUserModify } from "./evm-user-modify";
import { encodeAgentEnableDexAbstraction } from "./agent-enable-dex-abstraction";
import { encodeAgentSetAbstraction } from "./agent-set-abstraction";
import { encodeAgentSendAsset } from "./agent-send-asset";
import { encodeMultiSig } from "./multi-sig";
import { APPROVE_AGENT } from "./approve-agent";
import { APPROVE_BUILDER_FEE } from "./approve-builder-fee";
import { USD_CLASS_TRANSFER } from "./usd-class-transfer";
import { SEND_ASSET } from "./send-asset";
import { SEND_TO_EVM_WITH_DATA } from "./send-to-evm-with-data";
import { USD_SEND } from "./usd-send";
import { SPOT_SEND } from "./spot-send";
import { WITHDRAW } from "./withdraw3";
import { CONVERT_TO_MULTI_SIG_USER } from "./convert-to-multi-sig-user";
import { TOKEN_DELEGATE } from "./token-delegate";
import { USER_DEX_ABSTRACTION } from "./user-dex-abstraction";
import { encodeTrailingStop } from "./trailing-stop";
import { encodeReserveRequestWeight } from "./reserve-request-weight";
import { encodeCDeposit2 } from "./c-deposit2";
import { C_DEPOSIT } from "./c-deposit";
import { C_WITHDRAW } from "./c-withdraw";
import { USER_SET_ABSTRACTION } from "./user-set-abstraction";
import { encodeHip3LiquidatorTransfer } from "./hip3-liquidator-transfer";
import { encodeUserOutcome } from "./user-outcome";
import { encodeSpotDeploy } from "../deploy/spot";
import { encodePerpDeploy } from "../deploy/perp";
import { encodeActivateOutcomeDeployer, encodeOutcomeDeploy } from "../deploy/outcome";

export { APPROVE_AGENT } from "./approve-agent";
export type { ApproveAgentAction } from "./approve-agent";
export { APPROVE_BUILDER_FEE } from "./approve-builder-fee";
export type { ApproveBuilderFeeAction } from "./approve-builder-fee";
export { encodeAgentEnableDexAbstraction } from "./agent-enable-dex-abstraction";
export type { AgentEnableDexAbstractionAction } from "./agent-enable-dex-abstraction";
export { encodeAgentSendAsset } from "./agent-send-asset";
export type { AgentSendAssetAction } from "./agent-send-asset";
export { encodeAgentSetAbstraction } from "./agent-set-abstraction";
export type { AgentSetAbstractionAction } from "./agent-set-abstraction";
export { BATCH_MODIFY_TYPE, encodeBatchModify } from "./batch-modify";
export type { BatchModifyAction } from "./batch-modify";
export { CANCEL_TYPE, encodeCancel } from "./cancel";
export type { CancelAction } from "./cancel";
export { CANCEL_BY_CLOID_TYPE, encodeCancelByCloid } from "./cancel-by-cloid";
export type { CancelByCloidAction } from "./cancel-by-cloid";
export { CONVERT_TO_MULTI_SIG_USER } from "./convert-to-multi-sig-user";
export type { ConvertToMultiSigUserAction } from "./convert-to-multi-sig-user";
export { encodeCreateSubAccount } from "./create-sub-account";
export type { CreateSubAccountAction } from "./create-sub-account";
export { encodeEvmUserModify } from "./evm-user-modify";
export type { EvmUserModifyAction } from "./evm-user-modify";
export { MODIFY_TYPE, encodeModify } from "./modify";
export type { ModifyAction } from "./modify";
export { encodeMultiSig } from "./multi-sig";
export type { MultiSigAction, MultiSigPayload, MultiSigSignature } from "./multi-sig";
export { NOOP_TYPE, encodeNoop } from "./noop";
export type { NoopAction } from "./noop";
export { ORDER_TYPE, encodeOrder } from "./order";
export type { Builder, Grouping, OrderAction, OrderWire, OrderTypeWire } from "./order";
export { SCHEDULE_CANCEL_TYPE, encodeScheduleCancel } from "./schedule-cancel";
export type { ScheduleCancelAction } from "./schedule-cancel";
export { SEND_ASSET } from "./send-asset";
export type { SendAssetAction } from "./send-asset";
export { SEND_TO_EVM_WITH_DATA, SEND_TO_EVM_WITH_DATA_TYPE } from "./send-to-evm-with-data";
export type { SendToEvmWithDataAction } from "./send-to-evm-with-data";
export { encodeSetReferrer } from "./set-referrer";
export type { SetReferrerAction } from "./set-referrer";
export { SPOT_SEND } from "./spot-send";
export type { SpotSendAction } from "./spot-send";
export { encodeSubAccountSpotTransfer } from "./sub-account-spot-transfer";
export type { SubAccountSpotTransferAction } from "./sub-account-spot-transfer";
export { encodeSubAccountTransfer } from "./sub-account-transfer";
export type { SubAccountTransferAction } from "./sub-account-transfer";
export { TOKEN_DELEGATE } from "./token-delegate";
export type { TokenDelegateAction } from "./token-delegate";
export {
  TOP_UP_ISOLATED_ONLY_MARGIN_TYPE,
  encodeTopUpIsolatedOnlyMargin,
} from "./top-up-isolated-only-margin";
export type { TopUpIsolatedOnlyMarginAction } from "./top-up-isolated-only-margin";
export { TWAP_CANCEL_TYPE, encodeTwapCancel } from "./twap-cancel";
export type { TwapCancelAction } from "./twap-cancel";
export { TWAP_ORDER_TYPE, encodeTwapOrder } from "./twap-order";
export type { TwapOrderAction } from "./twap-order";
export { UPDATE_ISOLATED_MARGIN_TYPE, encodeUpdateIsolatedMargin } from "./update-isolated-margin";
export type { UpdateIsolatedMarginAction } from "./update-isolated-margin";
export { UPDATE_LEVERAGE_TYPE, encodeUpdateLeverage } from "./update-leverage";
export type { UpdateLeverageAction } from "./update-leverage";
export { USD_CLASS_TRANSFER } from "./usd-class-transfer";
export type { UsdClassTransferAction } from "./usd-class-transfer";
export { USD_SEND } from "./usd-send";
export type { UsdSendAction } from "./usd-send";
export { USER_DEX_ABSTRACTION } from "./user-dex-abstraction";
export type { UserDexAbstractionAction } from "./user-dex-abstraction";
export {
  HIP3_LIQUIDATOR_TRANSFER,
  HIP3_LIQUIDATOR_TRANSFER_TYPE,
  encodeHip3LiquidatorTransfer,
} from "./hip3-liquidator-transfer";
export type { Hip3LiquidatorTransferAction } from "./hip3-liquidator-transfer";
export { TRAILING_STOP_TYPE, encodeTrailingStop } from "./trailing-stop";
export type { TrailingRetracement, TrailingStopAction } from "./trailing-stop";
export { RESERVE_REQUEST_WEIGHT_TYPE, encodeReserveRequestWeight } from "./reserve-request-weight";
export type { ReserveRequestWeightAction } from "./reserve-request-weight";
export { C_DEPOSIT2_TYPE, encodeCDeposit2 } from "./c-deposit2";
export type { CDeposit2Action } from "./c-deposit2";
export { C_DEPOSIT, C_DEPOSIT_TYPE } from "./c-deposit";
export type { CDepositAction } from "./c-deposit";
export { C_WITHDRAW, C_WITHDRAW_TYPE } from "./c-withdraw";
export type { CWithdrawAction } from "./c-withdraw";
export { USER_SET_ABSTRACTION, USER_SET_ABSTRACTION_TYPE } from "./user-set-abstraction";
export type { Abstraction, UserSetAbstractionAction } from "./user-set-abstraction";
export { USER_OUTCOME_TYPE, encodeUserOutcome } from "./user-outcome";
export type {
  MergeOutcomeAction,
  MergeQuestionAction,
  NegateOutcomeAction,
  SplitOutcomeAction,
  UserOutcomeAction,
} from "./user-outcome";
export { encodeVaultTransfer } from "./vault-transfer";
export type { VaultTransferAction } from "./vault-transfer";
export { WITHDRAW } from "./withdraw3";
export type { WithdrawAction } from "./withdraw3";
export { encodeActivateOutcomeDeployer, encodeOutcomeDeploy } from "../deploy/outcome";
export type { ActivateOutcomeDeployerAction, OutcomeDeployAction } from "../deploy/outcome";
export { encodePerpDeploy } from "../deploy/perp";
export type { PerpDeployAction } from "../deploy/perp";
export { encodeSpotDeploy } from "../deploy/spot";
export type { SpotDeployAction } from "../deploy/spot";

import type { OrderAction } from "./order";
import type { CancelAction } from "./cancel";
import type { CancelByCloidAction } from "./cancel-by-cloid";
import type { ModifyAction } from "./modify";
import type { BatchModifyAction } from "./batch-modify";
import type { ScheduleCancelAction } from "./schedule-cancel";
import type { UpdateLeverageAction } from "./update-leverage";
import type { UpdateIsolatedMarginAction } from "./update-isolated-margin";
import type { TopUpIsolatedOnlyMarginAction } from "./top-up-isolated-only-margin";
import type { TwapOrderAction } from "./twap-order";
import type { TwapCancelAction } from "./twap-cancel";
import type { NoopAction } from "./noop";
import type { SetReferrerAction } from "./set-referrer";
import type { CreateSubAccountAction } from "./create-sub-account";
import type { SubAccountTransferAction } from "./sub-account-transfer";
import type { SubAccountSpotTransferAction } from "./sub-account-spot-transfer";
import type { VaultTransferAction } from "./vault-transfer";
import type { EvmUserModifyAction } from "./evm-user-modify";
import type { AgentEnableDexAbstractionAction } from "./agent-enable-dex-abstraction";
import type { AgentSetAbstractionAction } from "./agent-set-abstraction";
import type { AgentSendAssetAction } from "./agent-send-asset";
import type { MultiSigAction } from "./multi-sig";
import type { UserOutcomeAction } from "./user-outcome";
import type { TrailingStopAction } from "./trailing-stop";
import type { ReserveRequestWeightAction } from "./reserve-request-weight";
import type { CDeposit2Action } from "./c-deposit2";
import type { Hip3LiquidatorTransferAction } from "./hip3-liquidator-transfer";
import type { SpotDeployAction } from "../deploy/spot";
import type { PerpDeployAction } from "../deploy/perp";
import type { ActivateOutcomeDeployerAction, OutcomeDeployAction } from "../deploy/outcome";

export type L1ActionName =
  | "order"
  | "cancel"
  | "cancelByCloid"
  | "modify"
  | "batchModify"
  | "scheduleCancel"
  | "updateLeverage"
  | "updateIsolatedMargin"
  | "topUpIsolatedOnlyMargin"
  | "twapOrder"
  | "twapCancel"
  | "noop"
  | "setReferrer"
  | "createSubAccount"
  | "subAccountTransfer"
  | "subAccountSpotTransfer"
  | "vaultTransfer"
  | "evmUserModify"
  | "agentEnableDexAbstraction"
  | "agentSetAbstraction"
  | "agentSendAsset"
  | "multiSig"
  | "userOutcome"
  | "trailingStop"
  | "reserveRequestWeight"
  | "cDeposit2"
  | "hip3LiquidatorTransfer"
  | "spotDeploy"
  | "perpDeploy"
  | "outcomeDeploy"
  | "activateOutcomeDeployer";

export type L1ActionOf = {
  order: OrderAction;
  cancel: CancelAction;
  cancelByCloid: CancelByCloidAction;
  modify: ModifyAction;
  batchModify: BatchModifyAction;
  scheduleCancel: ScheduleCancelAction;
  updateLeverage: UpdateLeverageAction;
  updateIsolatedMargin: UpdateIsolatedMarginAction;
  topUpIsolatedOnlyMargin: TopUpIsolatedOnlyMarginAction;
  twapOrder: TwapOrderAction;
  twapCancel: TwapCancelAction;
  noop: NoopAction;
  setReferrer: SetReferrerAction;
  createSubAccount: CreateSubAccountAction;
  subAccountTransfer: SubAccountTransferAction;
  subAccountSpotTransfer: SubAccountSpotTransferAction;
  vaultTransfer: VaultTransferAction;
  evmUserModify: EvmUserModifyAction;
  agentEnableDexAbstraction: AgentEnableDexAbstractionAction;
  agentSetAbstraction: AgentSetAbstractionAction;
  agentSendAsset: AgentSendAssetAction;
  multiSig: MultiSigAction;
  userOutcome: UserOutcomeAction;
  trailingStop: TrailingStopAction;
  reserveRequestWeight: ReserveRequestWeightAction;
  cDeposit2: CDeposit2Action;
  hip3LiquidatorTransfer: Hip3LiquidatorTransferAction;
  spotDeploy: SpotDeployAction;
  perpDeploy: PerpDeployAction;
  outcomeDeploy: OutcomeDeployAction;
  activateOutcomeDeployer: ActivateOutcomeDeployerAction;
};

export type EncoderFor<K extends L1ActionName> = (action: L1ActionOf[K]) => MpMap;

export const L1_ENCODERS = {
  order: encodeOrder,
  cancel: encodeCancel,
  cancelByCloid: encodeCancelByCloid,
  modify: encodeModify,
  batchModify: encodeBatchModify,
  scheduleCancel: encodeScheduleCancel,
  updateLeverage: encodeUpdateLeverage,
  updateIsolatedMargin: encodeUpdateIsolatedMargin,
  topUpIsolatedOnlyMargin: encodeTopUpIsolatedOnlyMargin,
  twapOrder: encodeTwapOrder,
  twapCancel: encodeTwapCancel,
  noop: encodeNoop,
  setReferrer: encodeSetReferrer,
  createSubAccount: encodeCreateSubAccount,
  subAccountTransfer: encodeSubAccountTransfer,
  subAccountSpotTransfer: encodeSubAccountSpotTransfer,
  vaultTransfer: encodeVaultTransfer,
  evmUserModify: encodeEvmUserModify,
  agentEnableDexAbstraction: encodeAgentEnableDexAbstraction,
  agentSetAbstraction: encodeAgentSetAbstraction,
  agentSendAsset: encodeAgentSendAsset,
  multiSig: encodeMultiSig,
  userOutcome: encodeUserOutcome,
  trailingStop: encodeTrailingStop,
  reserveRequestWeight: encodeReserveRequestWeight,
  cDeposit2: encodeCDeposit2,
  hip3LiquidatorTransfer: encodeHip3LiquidatorTransfer,
  spotDeploy: encodeSpotDeploy,
  perpDeploy: encodePerpDeploy,
  outcomeDeploy: encodeOutcomeDeploy,
  activateOutcomeDeployer: encodeActivateOutcomeDeployer,
} as const satisfies { [K in keyof L1ActionOf]: (action: L1ActionOf[K]) => MpMap };

export type UserSignedActionOf = {
  approveAgent: Parameters<typeof APPROVE_AGENT.encode>[0];
  approveBuilderFee: Parameters<typeof APPROVE_BUILDER_FEE.encode>[0];
  usdClassTransfer: Parameters<typeof USD_CLASS_TRANSFER.encode>[0];
  sendAsset: Parameters<typeof SEND_ASSET.encode>[0];
  sendToEvmWithData: Parameters<typeof SEND_TO_EVM_WITH_DATA.encode>[0];
  usdSend: Parameters<typeof USD_SEND.encode>[0];
  spotSend: Parameters<typeof SPOT_SEND.encode>[0];
  withdraw3: Parameters<typeof WITHDRAW.encode>[0];
  convertToMultiSigUser: Parameters<typeof CONVERT_TO_MULTI_SIG_USER.encode>[0];
  tokenDelegate: Parameters<typeof TOKEN_DELEGATE.encode>[0];
  userDexAbstraction: Parameters<typeof USER_DEX_ABSTRACTION.encode>[0];
  userSetAbstraction: Parameters<typeof USER_SET_ABSTRACTION.encode>[0];
  cDeposit: Parameters<typeof C_DEPOSIT.encode>[0];
  cWithdraw: Parameters<typeof C_WITHDRAW.encode>[0];
};

export type UserSignedDescriptor<A> = {
  readonly type: string;
  readonly typeName: string;
  readonly fieldTypes: readonly Eip712FieldType[];
  readonly encode: (action: A) => MpMap;
};

export type UserSignedRegistry = {
  [K in keyof UserSignedActionOf]: UserSignedDescriptor<UserSignedActionOf[K]>;
};

export const USER_SIGNED: UserSignedRegistry = {
  approveAgent: APPROVE_AGENT,
  approveBuilderFee: APPROVE_BUILDER_FEE,
  usdClassTransfer: USD_CLASS_TRANSFER,
  sendAsset: SEND_ASSET,
  sendToEvmWithData: SEND_TO_EVM_WITH_DATA,
  usdSend: USD_SEND,
  spotSend: SPOT_SEND,
  withdraw3: WITHDRAW,
  convertToMultiSigUser: CONVERT_TO_MULTI_SIG_USER,
  tokenDelegate: TOKEN_DELEGATE,
  userDexAbstraction: USER_DEX_ABSTRACTION,
  userSetAbstraction: USER_SET_ABSTRACTION,
  cDeposit: C_DEPOSIT,
  cWithdraw: C_WITHDRAW,
};

export type UserSignedActionType = keyof typeof USER_SIGNED;

export function userSignedEncode(type: UserSignedActionType, action: unknown): MpMap {
  const encode = cast<(action: unknown) => MpMap>(USER_SIGNED[type].encode, "action");
  return encode(action);
}
