/**
 * @hyperliquid-api POST /exchange
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint.md
 */

import { ExchangeError, ValidationError } from "../core/errors";
import { cast } from "../core/parse";
import type { Digest32, L1Action } from "../core/eip712";
import { toObject, type MpMap } from "../core/msgpack";
import { NonceSource } from "../core/nonce";
import type { Transport } from "../core/transport";
import {
  PINNED_BUILDERS,
  Signer,
  assertBuilderAllowed,
  prepareL1,
  prepareUserSigned,
  signL1With,
  signUserSignedWith,
  type BuilderPolicy,
  type Hex,
  type L1DigestBundle,
  type L1Signature,
  type L1SignOptions,
  type L1TypedData,
  type SignedL1Action,
  type TypedDataSigner,
  type UserSignature,
  type UserSignedActionType,
  type UserSignedTypedData,
} from "../signing";
import {
  L1_ENCODERS,
  USER_SIGNED,
  type AgentEnableDexAbstractionAction,
  type AgentSendAssetAction,
  type AgentSetAbstractionAction,
  type ApproveAgentAction,
  type ApproveBuilderFeeAction,
  type BatchModifyAction,
  type Builder,
  type CancelAction,
  type CancelByCloidAction,
  type CDeposit2Action,
  type CDepositAction,
  type ConvertToMultiSigUserAction,
  type CreateSubAccountAction,
  type CWithdrawAction,
  type EvmUserModifyAction,
  type Hip3LiquidatorTransferAction,
  type L1ActionName,
  type L1ActionOf,
  type ModifyAction,
  type MultiSigAction,
  type NoopAction,
  type OrderAction,
  type ReserveRequestWeightAction,
  type ScheduleCancelAction,
  type SendAssetAction,
  type SendToEvmWithDataAction,
  type SetReferrerAction,
  type SpotSendAction,
  type SubAccountSpotTransferAction,
  type SubAccountTransferAction,
  type TokenDelegateAction,
  type TopUpIsolatedOnlyMarginAction,
  type TrailingStopAction,
  type TwapCancelAction,
  type TwapOrderAction,
  type UpdateIsolatedMarginAction,
  type UpdateLeverageAction,
  type UsdClassTransferAction,
  type UsdSendAction,
  type UserDexAbstractionAction,
  type UserSetAbstractionAction,
  type UserSignedActionOf,
  type VaultTransferAction,
  type WithdrawAction,
  type SpotDeployAction,
  type PerpDeployAction,
  type OutcomeDeployAction,
  type ActivateOutcomeDeployerAction,
} from "./actions/index";
import {
  type MergeOutcomeAction,
  type MergeQuestionAction,
  type NegateOutcomeAction,
  type SplitOutcomeAction,
  type UserOutcomeAction,
} from "./actions/user-outcome";
import { parseExchange, type ExchangeOk } from "./response";

export type DigestEnvelope = {
  action: unknown;
  nonce: number;
  vaultAddress?: string;
  expiresAfter?: number;
  isTestnet: boolean;
  source: "a" | "b";
  connectionId: Hex;
  typedData: L1TypedData | UserSignedTypedData;
};

export type ExchangeClientOptions = {
  transport: Transport;
  signer?: Signer;
  wallet?: TypedDataSigner;
  nonce?: NonceSource;
  vaultAddress?: string;
  expiresAfter?: number;
  signatureChainId?: number;
  isTestnet?: boolean;
  builders?: BuilderPolicy;
  onDigest?: (digest: Digest32, envelope: DigestEnvelope) => void;
};

type ResponseType = "order" | "cancel" | "cancelByCloid" | "batchModify" | "default";

const EXPECTED_RESPONSE_TYPE = new Map<string, ResponseType>([
  ["order", "order"],
  ["cancel", "cancel"],
  ["cancelByCloid", "cancelByCloid"],
  ["batchModify", "batchModify"],
]);

const expectedResponseType = (actionType: string): ResponseType =>
  EXPECTED_RESPONSE_TYPE.get(actionType) ?? "default";

type NonceBearing = { readonly nonce?: unknown; readonly time?: unknown };

const L1_ENCODER_FOR: { [K in L1ActionName]: (action: L1ActionOf[K]) => MpMap } = L1_ENCODERS;

function encodeFor<K extends L1ActionName>(type: K, action: L1ActionOf[K]): MpMap {
  return L1_ENCODER_FOR[type](action);
}

const nonceOf = (record: NonceBearing): number => {
  const value = typeof record.nonce === "number" ? record.nonce : record.time;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError("action.nonce", "nonce or time");
  }
  return value;
};

const builderFeeTenths = (rate: string): number => {
  const match = /^(\d+)(?:\.(\d{1,3}))?%$/.exec(rate);
  if (match === null) {
    throw new ValidationError("builder.maxFeeRate", "percent with at most 3 decimals");
  }
  const tenths = Number(match[1]) * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
  if (!Number.isSafeInteger(tenths)) {
    throw new ValidationError("builder.maxFeeRate", "safe integer");
  }
  return tenths;
};

const batchLengthOf = (action: unknown): number => {
  const record = cast<Record<string, unknown>>(action, "action");
  for (const key of ["orders", "cancels", "modifies"] as const) {
    const value = record[key];
    if (Array.isArray(value)) return value.length;
  }
  return 0;
};

const freezeDeep = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null) return value;
  Object.freeze(value);
  for (const item of Object.values(cast<Record<string, unknown>>(value, "digest.action"))) {
    freezeDeep(item);
  }
  return value;
};

const copyActionForDigest = (action: unknown): unknown => {
  const clone: unknown =
    typeof globalThis.structuredClone === "function"
      ? globalThis.structuredClone(action)
      : JSON.parse(JSON.stringify(action));
  return freezeDeep(clone);
};

type EnvelopeBase = {
  action: unknown;
  nonce: number;
  vaultAddress?: string;
  expiresAfter?: number;
};

type EnvelopeMeta = {
  isTestnet: boolean;
  source: "a" | "b";
  connectionId: Hex;
  typedData: L1TypedData | UserSignedTypedData;
};

const bindEnvelope = (base: EnvelopeBase, meta: EnvelopeMeta): DigestEnvelope =>
  cast<DigestEnvelope>({ ...base, ...meta }, "digest.envelope");

const asL1ActionFrom = (encoded: MpMap, canonical: Record<string, unknown>): L1Action => {
  const first = encoded[0];
  if (first === undefined || first[0] !== "type" || typeof first[1] !== "string") {
    throw new ValidationError("action", "type as the first field");
  }
  return cast<L1Action>(canonical, "action");
};

const parseExchangeOk = (u: unknown): ExchangeOk => {
  const response = parseExchange(u);
  if (response.status === "err") {
    throw new ExchangeError(response.response);
  }
  return response;
};

const assertResponseType = (response: ExchangeOk, expected: ResponseType): ExchangeOk => {
  if (response.response.type !== expected) {
    throw new ExchangeError(
      `response.type ${response.response.type} did not match submitted ${expected}`,
    );
  }
  return response;
};

const assertSubBuildersAllowed = (builder: Builder, policy: BuilderPolicy): void => {
  const subs = builder.s;
  if (subs === undefined) return;
  let total = 0;
  subs.forEach((sub, index) => {
    const allowed = policy.get(sub.b.toLowerCase());
    if (allowed === undefined) {
      throw new ValidationError(`builder.s[${index}].b`, "allowlisted builder address");
    }
    if (!Number.isFinite(sub.s) || sub.s < 0 || sub.s > allowed) {
      throw new ValidationError(`builder.s[${index}].s`, `<= ${allowed}`);
    }
    total += sub.s;
  });
  if (total > builder.f) {
    throw new ValidationError("builder.s", `sum <= builder.f (${builder.f})`);
  }
};

export class ExchangeClient {
  readonly #transport: Transport;
  readonly #signer: Signer | undefined;
  readonly #wallet: TypedDataSigner | undefined;
  readonly #address: string;
  readonly #nonce: NonceSource;
  readonly #vaultAddress: string | undefined;
  readonly #expiresAfter: number | undefined;
  readonly #signatureChainId: number;
  readonly #isTestnet: boolean;
  readonly #builders: BuilderPolicy;
  readonly #onDigest: ((digest: Digest32, envelope: DigestEnvelope) => void) | undefined;

  constructor(o: ExchangeClientOptions) {
    this.#isTestnet = o.isTestnet ?? false;
    this.#transport = o.transport;
    const signer = o.signer;
    const wallet = o.wallet;
    if (signer !== undefined && wallet !== undefined) {
      throw new ValidationError("signer", "exactly one of signer or wallet");
    }
    if (signer === undefined) {
      if (wallet === undefined) {
        throw new ValidationError("signer", "exactly one of signer or wallet");
      }
      this.#signer = undefined;
      this.#wallet = wallet;
      this.#address = wallet.address;
    } else {
      const network = this.#isTestnet ? "testnet" : "mainnet";
      if (signer.network !== network) {
        throw new ValidationError("signer.network", network);
      }
      this.#signer = signer;
      this.#wallet = undefined;
      this.#address = signer.address;
    }
    this.#nonce = o.nonce ?? new NonceSource();
    this.#vaultAddress = o.vaultAddress;
    this.#expiresAfter = o.expiresAfter;
    this.#signatureChainId = o.signatureChainId ?? (this.#isTestnet ? 421614 : 42161);
    this.#builders = o.builders ?? PINNED_BUILDERS;
    this.#onDigest = o.onDigest;
  }

  #l1Options(): L1SignOptions {
    return {
      vault: this.#vaultAddress ?? null,
      expiresAfter: this.#expiresAfter === undefined ? null : BigInt(this.#expiresAfter),
      isTestnet: this.#isTestnet,
    };
  }

  #l1Envelope(canonical: Record<string, unknown>, prepared: L1DigestBundle): DigestEnvelope {
    const base: EnvelopeBase = {
      action: copyActionForDigest(canonical),
      nonce: prepared.nonce,
    };
    if (this.#vaultAddress !== undefined) base.vaultAddress = this.#vaultAddress;
    if (this.#expiresAfter !== undefined) base.expiresAfter = this.#expiresAfter;
    return bindEnvelope(base, {
      isTestnet: this.#isTestnet,
      source: this.#isTestnet ? "b" : "a",
      connectionId: prepared.connectionId,
      typedData: prepared.typedData,
    });
  }

  async #signL1(wire: L1Action, nonce: bigint): Promise<SignedL1Action> {
    const opts = this.#l1Options();
    if (this.#wallet !== undefined) {
      const signed = await signL1With(this.#wallet, wire, nonce, opts);
      const result: SignedL1Action = {
        nonce: signed.nonce,
        signature: signed.signature,
        digest: signed.digest,
      };
      if (this.#vaultAddress !== undefined) result.vaultAddress = this.#vaultAddress;
      if (this.#expiresAfter !== undefined) result.expiresAfter = this.#expiresAfter;
      return result;
    }
    const signer = this.#signer;
    if (signer === undefined) {
      throw new ValidationError("signer", "configured");
    }
    return signer.signL1(wire, nonce, opts.vault, opts.expiresAfter, opts.isTestnet);
  }

  async #postL1<A>(
    encode: (action: A) => MpMap,
    action: A,
    expected: ResponseType,
    explicitNonce?: number,
  ): Promise<ExchangeOk> {
    const nonce = this.#nonce.reserve(this.#address, explicitNonce);
    const encoded = encode(action);
    const canonical = toObject(encoded);
    const wire = asL1ActionFrom(encoded, canonical);
    const prepared = prepareL1(wire, nonce, this.#l1Options());
    this.#onDigest?.(prepared.digest, this.#l1Envelope(canonical, prepared));
    const signed = await this.#signL1(wire, nonce);
    const body: L1Signature & { action: Record<string, unknown> } = {
      action: canonical,
      nonce: signed.nonce,
      signature: signed.signature,
    };
    if (signed.vaultAddress !== undefined) body.vaultAddress = signed.vaultAddress;
    if (signed.expiresAfter !== undefined) body.expiresAfter = signed.expiresAfter;
    const verify = (u: unknown): ExchangeOk => assertResponseType(parseExchangeOk(u), expected);
    return this.#transport.postExchange(body, verify, batchLengthOf(action));
  }

  #postL1ByType<K extends L1ActionName>(
    type: K,
    action: L1ActionOf[K],
    explicitNonce?: number,
  ): Promise<ExchangeOk> {
    return this.#postL1(
      (a: L1ActionOf[K]) => encodeFor(type, a),
      action,
      expectedResponseType(type),
      explicitNonce,
    );
  }

  #postL1ByEncoder(action: UserOutcomeAction): Promise<ExchangeOk> {
    return this.#postL1((a: UserOutcomeAction) => encodeFor("userOutcome", a), action, "default");
  }

  async #postUserSigned<K extends UserSignedActionType>(
    type: K,
    action: UserSignedActionOf[K],
  ): Promise<ExchangeOk> {
    const wire = toObject(USER_SIGNED[type].encode(action));
    wire["hyperliquidChain"] = this.#isTestnet ? "Testnet" : "Mainnet";
    wire["signatureChainId"] = `0x${this.#signatureChainId.toString(16)}`;
    if (type === "withdraw3") wire["nonce"] = wire["time"];
    const nonce = nonceOf(wire);
    if (type === "withdraw3") this.#nonce.reserve(this.#address, nonce);
    const prepared = prepareUserSigned(type, wire, this.#signatureChainId);
    const envelope = bindEnvelope(
      { action: copyActionForDigest(wire), nonce },
      {
        isTestnet: this.#isTestnet,
        source: this.#isTestnet ? "b" : "a",
        connectionId: prepared.connectionId,
        typedData: prepared.typedData,
      },
    );
    this.#onDigest?.(prepared.digest, envelope);
    let signed: UserSignature;
    if (this.#wallet === undefined) {
      const signer = this.#signer;
      if (signer === undefined) {
        throw new ValidationError("signer", "configured");
      }
      signed = signer.signUserSigned(type, wire, this.#signatureChainId);
    } else {
      signed = await signUserSignedWith(this.#wallet, type, wire, this.#signatureChainId);
    }
    const verify = (u: unknown): ExchangeOk => assertResponseType(parseExchangeOk(u), "default");
    return this.#transport.postExchange(
      { action: wire, nonce, signature: signed.signature },
      verify,
      0,
    );
  }

  #encodePreview(action: OrderAction | CancelAction | UpdateLeverageAction): MpMap {
    if ("orders" in action) return encodeFor("order", action);
    if ("cancels" in action) return encodeFor("cancel", action);
    return encodeFor("updateLeverage", action);
  }

  preview(
    action: OrderAction | CancelAction | UpdateLeverageAction,
    opts: { nonce?: number } = {},
  ): { envelope: DigestEnvelope; noop: true } {
    const encoded = this.#encodePreview(action);
    const canonical = toObject(encoded);
    const nonce = opts.nonce ?? Date.now();
    const prepared = prepareL1(
      asL1ActionFrom(encoded, canonical),
      BigInt(nonce),
      this.#l1Options(),
    );
    return { envelope: this.#l1Envelope(canonical, prepared), noop: true };
  }

  order(action: OrderAction): Promise<ExchangeOk> {
    if (action.builder !== undefined) {
      assertBuilderAllowed(action.builder, this.#builders);
      assertSubBuildersAllowed(action.builder, this.#builders);
    }
    return this.#postL1ByType("order", action);
  }

  cancel(action: CancelAction): Promise<ExchangeOk> {
    return this.#postL1ByType("cancel", action);
  }

  cancelByCloid(action: CancelByCloidAction): Promise<ExchangeOk> {
    return this.#postL1ByType("cancelByCloid", action);
  }

  modify(action: ModifyAction): Promise<ExchangeOk> {
    return this.#postL1ByType("modify", action);
  }

  batchModify(action: BatchModifyAction): Promise<ExchangeOk> {
    return this.#postL1ByType("batchModify", action);
  }

  scheduleCancel(action: ScheduleCancelAction): Promise<ExchangeOk> {
    return this.#postL1ByType("scheduleCancel", action);
  }

  updateLeverage(action: UpdateLeverageAction): Promise<ExchangeOk> {
    return this.#postL1ByType("updateLeverage", action);
  }

  updateIsolatedMargin(action: UpdateIsolatedMarginAction): Promise<ExchangeOk> {
    return this.#postL1ByType("updateIsolatedMargin", action);
  }

  topUpIsolatedOnlyMargin(action: TopUpIsolatedOnlyMarginAction): Promise<ExchangeOk> {
    return this.#postL1ByType("topUpIsolatedOnlyMargin", action);
  }

  twapOrder(action: TwapOrderAction): Promise<ExchangeOk> {
    return this.#postL1ByType("twapOrder", action);
  }

  twapCancel(action: TwapCancelAction): Promise<ExchangeOk> {
    return this.#postL1ByType("twapCancel", action);
  }

  noop(): Promise<ExchangeOk> {
    const action: NoopAction = {};
    return this.#postL1ByType("noop", action);
  }

  setReferrer(action: SetReferrerAction): Promise<ExchangeOk> {
    return this.#postL1ByType("setReferrer", action);
  }

  createSubAccount(action: CreateSubAccountAction): Promise<ExchangeOk> {
    return this.#postL1ByType("createSubAccount", action);
  }

  subAccountTransfer(action: SubAccountTransferAction): Promise<ExchangeOk> {
    return this.#postL1ByType("subAccountTransfer", action);
  }

  subAccountSpotTransfer(action: SubAccountSpotTransferAction): Promise<ExchangeOk> {
    return this.#postL1ByType("subAccountSpotTransfer", action);
  }

  vaultTransfer(action: VaultTransferAction): Promise<ExchangeOk> {
    return this.#postL1ByType("vaultTransfer", action);
  }

  evmUserModify(action: EvmUserModifyAction): Promise<ExchangeOk> {
    return this.#postL1ByType("evmUserModify", action);
  }

  agentEnableDexAbstraction(): Promise<ExchangeOk> {
    const action: AgentEnableDexAbstractionAction = { type: "agentEnableDexAbstraction" };
    return this.#postL1ByType("agentEnableDexAbstraction", action);
  }

  agentSetAbstraction(action: AgentSetAbstractionAction): Promise<ExchangeOk> {
    return this.#postL1ByType("agentSetAbstraction", action);
  }

  agentSendAsset(action: AgentSendAssetAction): Promise<ExchangeOk> {
    const nonce = Number(this.#nonce.reserve(this.#address));
    const payload: AgentSendAssetAction = { ...action, nonce };
    return this.#postL1ByType("agentSendAsset", payload, nonce);
  }

  multiSig(action: MultiSigAction): Promise<ExchangeOk> {
    return this.#postL1ByType("multiSig", action);
  }

  trailingStop(action: TrailingStopAction): Promise<ExchangeOk> {
    return this.#postL1ByType("trailingStop", action);
  }

  reserveRequestWeight(action: ReserveRequestWeightAction): Promise<ExchangeOk> {
    return this.#postL1ByType("reserveRequestWeight", action);
  }

  cDeposit2(action: CDeposit2Action): Promise<ExchangeOk> {
    return this.#postL1ByType("cDeposit2", action);
  }

  hip3LiquidatorTransfer(action: Hip3LiquidatorTransferAction): Promise<ExchangeOk> {
    return this.#postL1ByType("hip3LiquidatorTransfer", action);
  }

  spotDeploy(action: SpotDeployAction): Promise<ExchangeOk> {
    return this.#postL1ByType("spotDeploy", action);
  }

  perpDeploy(action: PerpDeployAction): Promise<ExchangeOk> {
    return this.#postL1ByType("perpDeploy", action);
  }

  outcomeDeploy(action: OutcomeDeployAction): Promise<ExchangeOk> {
    return this.#postL1ByType("outcomeDeploy", action);
  }

  activateOutcomeDeployer(action: ActivateOutcomeDeployerAction): Promise<ExchangeOk> {
    return this.#postL1ByType("activateOutcomeDeployer", action);
  }

  splitOutcome(action: SplitOutcomeAction["splitOutcome"]): Promise<ExchangeOk> {
    return this.#postL1ByEncoder({ type: "userOutcome", splitOutcome: action });
  }

  mergeOutcome(action: MergeOutcomeAction["mergeOutcome"]): Promise<ExchangeOk> {
    return this.#postL1ByEncoder({ type: "userOutcome", mergeOutcome: action });
  }

  mergeQuestion(action: MergeQuestionAction["mergeQuestion"]): Promise<ExchangeOk> {
    return this.#postL1ByEncoder({ type: "userOutcome", mergeQuestion: action });
  }

  negateOutcome(action: NegateOutcomeAction["negateOutcome"]): Promise<ExchangeOk> {
    return this.#postL1ByEncoder({ type: "userOutcome", negateOutcome: action });
  }

  approveAgent(action: ApproveAgentAction): Promise<ExchangeOk> {
    return this.#postUserSigned("approveAgent", action);
  }

  approveBuilderFee(action: ApproveBuilderFeeAction): Promise<ExchangeOk> {
    assertBuilderAllowed(
      { b: action.builder, f: builderFeeTenths(action.maxFeeRate) },
      this.#builders,
    );
    return this.#postUserSigned("approveBuilderFee", action);
  }

  usdClassTransfer(action: UsdClassTransferAction): Promise<ExchangeOk> {
    return this.#postUserSigned("usdClassTransfer", action);
  }

  sendAsset(action: SendAssetAction): Promise<ExchangeOk> {
    return this.#postUserSigned("sendAsset", action);
  }

  sendToEvmWithData(action: SendToEvmWithDataAction): Promise<ExchangeOk> {
    return this.#postUserSigned("sendToEvmWithData", action);
  }

  usdSend(action: UsdSendAction): Promise<ExchangeOk> {
    return this.#postUserSigned("usdSend", action);
  }

  spotSend(action: SpotSendAction): Promise<ExchangeOk> {
    return this.#postUserSigned("spotSend", action);
  }

  withdraw3(action: WithdrawAction): Promise<ExchangeOk> {
    return this.#postUserSigned("withdraw3", action);
  }

  convertToMultiSigUser(action: ConvertToMultiSigUserAction): Promise<ExchangeOk> {
    return this.#postUserSigned("convertToMultiSigUser", action);
  }

  tokenDelegate(action: TokenDelegateAction): Promise<ExchangeOk> {
    return this.#postUserSigned("tokenDelegate", action);
  }

  userDexAbstraction(action: UserDexAbstractionAction): Promise<ExchangeOk> {
    return this.#postUserSigned("userDexAbstraction", action);
  }

  userSetAbstraction(action: UserSetAbstractionAction): Promise<ExchangeOk> {
    return this.#postUserSigned("userSetAbstraction", action);
  }

  cDeposit(action: CDepositAction): Promise<ExchangeOk> {
    return this.#postUserSigned("cDeposit", action);
  }

  cWithdraw(action: CWithdrawAction): Promise<ExchangeOk> {
    return this.#postUserSigned("cWithdraw", action);
  }
}
