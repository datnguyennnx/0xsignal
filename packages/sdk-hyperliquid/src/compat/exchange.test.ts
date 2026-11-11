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
import type { Digest32 } from "../core/eip712";
import { map } from "../core/msgpack";
import { cast } from "../core/parse";
import { Transport } from "../core/transport";
import { ExchangeClient, type DigestEnvelope } from "../exchange/client";
import type { ExchangeOk } from "../exchange/response";
import { Signer } from "../signing";

const PRIVATE_KEY_HEX = "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
const ADDRESS: Address = asAddress("0x1111111111111111111111111111111111111111");
const OTHER: Address = asAddress("0x2222222222222222222222222222222222222222");
const CLOID: Cloid = asCloid("0x0102030405060708090a0b0c0d0e0f10");

const bytesFromHex = (hex: string): Uint8Array => {
  const body = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(body.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
};

const px = (value: string): WirePx => cast<WirePx>(asDecimal(value), "px");
const sz = (value: string): WireSz => cast<WireSz>(asDecimal(value), "sz");

const ORDER = {
  a: 0,
  b: true,
  p: px("100"),
  s: sz("1"),
  r: false,
  t: { limit: { tif: "Gtc" } },
};

const CHAIN = { hyperliquidChain: "Mainnet", signatureChainId: "0xa4b1" } as const;

type SampleActionName = {
  [M in keyof ExchangeClient]: Parameters<ExchangeClient[M]> extends [unknown] ? M : never;
}[keyof ExchangeClient];

type SampleAction = {
  [M in SampleActionName]: Parameters<ExchangeClient[M]>[0];
};

const SAMPLES: Record<string, unknown> = {
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
  vaultTransfer: { type: "vaultTransfer", vaultAddress: ADDRESS, isDeposit: true, usd: 1 },
  evmUserModify: { type: "evmUserModify", usingBigBlocks: true },
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
  splitOutcome: { outcome: 0, amount: asDecimal("1") },
  mergeOutcome: { outcome: 0, amount: null },
  mergeQuestion: { question: 0, amount: null },
  negateOutcome: { question: 0, outcome: 0, amount: asDecimal("1") },
  approveAgent: { agentAddress: ADDRESS, agentName: "agent", nonce: 1, ...CHAIN },
  approveBuilderFee: { maxFeeRate: "0.01%", builder: ADDRESS, nonce: 1, ...CHAIN },
  usdClassTransfer: { amount: asDecimal("100"), toPerp: true, nonce: 1, ...CHAIN },
  sendAsset: {
    destination: ADDRESS,
    sourceDex: "",
    destinationDex: "",
    token: 0,
    amount: asDecimal("1"),
    fromSubAccount: false,
    nonce: 1,
    ...CHAIN,
  },
  sendToEvmWithData: {
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
  usdSend: { destination: ADDRESS, amount: asDecimal("1"), time: 1, ...CHAIN },
  spotSend: { destination: ADDRESS, token: "USDC", amount: asDecimal("1"), time: 1, ...CHAIN },
  withdraw3: { destination: ADDRESS, amount: asDecimal("1"), time: Date.now(), ...CHAIN },
  convertToMultiSigUser: { signers: "[]", nonce: 1, ...CHAIN },
  tokenDelegate: { validator: ADDRESS, wei: 1, isUndelegate: false, nonce: 1, ...CHAIN },
  userDexAbstraction: { user: ADDRESS, enabled: true, nonce: 1, ...CHAIN },
  userSetAbstraction: { user: ADDRESS, abstraction: "disabled", nonce: 1 },
  cDeposit: { wei: 1, nonce: 1 },
  cWithdraw: { wei: 1, nonce: 1 },
};

const sampleOf = <M extends SampleActionName>(name: M): SampleAction[M] =>
  cast<SampleAction[M]>(SAMPLES[name], name);

type WireKind = "l1" | "userSigned";
type ResponseType = "order" | "cancel" | "cancelByCloid" | "batchModify" | "default";

type WireCase = {
  readonly method: string;
  readonly wireType: string;
  readonly kind: WireKind;
  readonly responseType: ResponseType;
  readonly call: (client: ExchangeClient) => Promise<ExchangeOk>;
};

const RESPONSE_TYPE: Partial<Record<string, ResponseType>> = {
  order: "order",
  cancel: "cancel",
  cancelByCloid: "cancelByCloid",
  batchModify: "batchModify",
};

const caseOf = (
  method: string,
  wireType: string,
  kind: WireKind,
  call: (client: ExchangeClient) => Promise<ExchangeOk>,
): WireCase => ({
  method,
  wireType,
  kind,
  responseType: RESPONSE_TYPE[method] ?? "default",
  call,
});

const APPROVE_BUILDER_FEE_CALL = (client: ExchangeClient): Promise<ExchangeOk> =>
  client.approveBuilderFee(sampleOf("approveBuilderFee"));

const CASES: readonly WireCase[] = [
  caseOf("order", "order", "l1", (c) => c.order(sampleOf("order"))),
  caseOf("cancel", "cancel", "l1", (c) => c.cancel(sampleOf("cancel"))),
  caseOf("cancelByCloid", "cancelByCloid", "l1", (c) => c.cancelByCloid(sampleOf("cancelByCloid"))),
  caseOf("modify", "modify", "l1", (c) => c.modify(sampleOf("modify"))),
  caseOf("batchModify", "batchModify", "l1", (c) => c.batchModify(sampleOf("batchModify"))),
  caseOf("scheduleCancel", "scheduleCancel", "l1", (c) =>
    c.scheduleCancel(sampleOf("scheduleCancel")),
  ),
  caseOf("updateLeverage", "updateLeverage", "l1", (c) =>
    c.updateLeverage(sampleOf("updateLeverage")),
  ),
  caseOf("updateIsolatedMargin", "updateIsolatedMargin", "l1", (c) =>
    c.updateIsolatedMargin(sampleOf("updateIsolatedMargin")),
  ),
  caseOf("topUpIsolatedOnlyMargin", "topUpIsolatedOnlyMargin", "l1", (c) =>
    c.topUpIsolatedOnlyMargin(sampleOf("topUpIsolatedOnlyMargin")),
  ),
  caseOf("twapOrder", "twapOrder", "l1", (c) => c.twapOrder(sampleOf("twapOrder"))),
  caseOf("twapCancel", "twapCancel", "l1", (c) => c.twapCancel(sampleOf("twapCancel"))),
  caseOf("noop", "noop", "l1", (c) => c.noop()),
  caseOf("setReferrer", "setReferrer", "l1", (c) => c.setReferrer(sampleOf("setReferrer"))),
  caseOf("createSubAccount", "createSubAccount", "l1", (c) =>
    c.createSubAccount(sampleOf("createSubAccount")),
  ),
  caseOf("subAccountTransfer", "subAccountTransfer", "l1", (c) =>
    c.subAccountTransfer(sampleOf("subAccountTransfer")),
  ),
  caseOf("subAccountSpotTransfer", "subAccountSpotTransfer", "l1", (c) =>
    c.subAccountSpotTransfer(sampleOf("subAccountSpotTransfer")),
  ),
  caseOf("vaultTransfer", "vaultTransfer", "l1", (c) => c.vaultTransfer(sampleOf("vaultTransfer"))),
  caseOf("evmUserModify", "evmUserModify", "l1", (c) => c.evmUserModify(sampleOf("evmUserModify"))),
  caseOf("agentEnableDexAbstraction", "agentEnableDexAbstraction", "l1", (c) =>
    c.agentEnableDexAbstraction(),
  ),
  caseOf("agentSetAbstraction", "agentSetAbstraction", "l1", (c) =>
    c.agentSetAbstraction(sampleOf("agentSetAbstraction")),
  ),
  caseOf("agentSendAsset", "agentSendAsset", "l1", (c) =>
    c.agentSendAsset(sampleOf("agentSendAsset")),
  ),
  caseOf("multiSig", "multiSig", "l1", (c) => c.multiSig(sampleOf("multiSig"))),
  caseOf("trailingStop", "trailingStop", "l1", (c) => c.trailingStop(sampleOf("trailingStop"))),
  caseOf("reserveRequestWeight", "reserveRequestWeight", "l1", (c) =>
    c.reserveRequestWeight(sampleOf("reserveRequestWeight")),
  ),
  caseOf("cDeposit2", "cDeposit2", "l1", (c) => c.cDeposit2(sampleOf("cDeposit2"))),
  caseOf("hip3LiquidatorTransfer", "hip3LiquidatorTransfer", "l1", (c) =>
    c.hip3LiquidatorTransfer(sampleOf("hip3LiquidatorTransfer")),
  ),
  caseOf("spotDeploy", "spotDeploy", "l1", (c) => c.spotDeploy(sampleOf("spotDeploy"))),
  caseOf("perpDeploy", "perpDeploy", "l1", (c) => c.perpDeploy(sampleOf("perpDeploy"))),
  caseOf("outcomeDeploy", "outcomeDeploy", "l1", (c) => c.outcomeDeploy(sampleOf("outcomeDeploy"))),
  caseOf("activateOutcomeDeployer", "activateOutcomeDeployer", "l1", (c) =>
    c.activateOutcomeDeployer(sampleOf("activateOutcomeDeployer")),
  ),
  caseOf("splitOutcome", "userOutcome", "l1", (c) => c.splitOutcome(sampleOf("splitOutcome"))),
  caseOf("mergeOutcome", "userOutcome", "l1", (c) => c.mergeOutcome(sampleOf("mergeOutcome"))),
  caseOf("mergeQuestion", "userOutcome", "l1", (c) => c.mergeQuestion(sampleOf("mergeQuestion"))),
  caseOf("negateOutcome", "userOutcome", "l1", (c) => c.negateOutcome(sampleOf("negateOutcome"))),
  caseOf("approveAgent", "approveAgent", "userSigned", (c) =>
    c.approveAgent(sampleOf("approveAgent")),
  ),
  caseOf("approveBuilderFee", "approveBuilderFee", "userSigned", APPROVE_BUILDER_FEE_CALL),
  caseOf("usdClassTransfer", "usdClassTransfer", "userSigned", (c) =>
    c.usdClassTransfer(sampleOf("usdClassTransfer")),
  ),
  caseOf("sendAsset", "sendAsset", "userSigned", (c) => c.sendAsset(sampleOf("sendAsset"))),
  caseOf("sendToEvmWithData", "sendToEvmWithData", "userSigned", (c) =>
    c.sendToEvmWithData(sampleOf("sendToEvmWithData")),
  ),
  caseOf("usdSend", "usdSend", "userSigned", (c) => c.usdSend(sampleOf("usdSend"))),
  caseOf("spotSend", "spotSend", "userSigned", (c) => c.spotSend(sampleOf("spotSend"))),
  caseOf("withdraw3", "withdraw3", "userSigned", (c) => c.withdraw3(sampleOf("withdraw3"))),
  caseOf("convertToMultiSigUser", "convertToMultiSigUser", "userSigned", (c) =>
    c.convertToMultiSigUser(sampleOf("convertToMultiSigUser")),
  ),
  caseOf("tokenDelegate", "tokenDelegate", "userSigned", (c) =>
    c.tokenDelegate(sampleOf("tokenDelegate")),
  ),
  caseOf("userDexAbstraction", "userDexAbstraction", "userSigned", (c) =>
    c.userDexAbstraction(sampleOf("userDexAbstraction")),
  ),
  caseOf("userSetAbstraction", "userSetAbstraction", "userSigned", (c) =>
    c.userSetAbstraction(sampleOf("userSetAbstraction")),
  ),
  caseOf("cDeposit", "cDeposit", "userSigned", (c) => c.cDeposit(sampleOf("cDeposit"))),
  caseOf("cWithdraw", "cWithdraw", "userSigned", (c) => c.cWithdraw(sampleOf("cWithdraw"))),
];

const responseBody = (type: ResponseType): unknown => {
  if (type === "default") return { status: "ok", response: { type: "default" } };
  return { status: "ok", response: { type, data: { statuses: [] } } };
};

const fakeFetch = (posted: Record<string, unknown>[], type: ResponseType): typeof fetch =>
  Object.assign(
    (_input: URL | RequestInfo, init?: BunFetchRequestInit): Promise<Response> => {
      const raw = typeof init?.body === "string" ? init.body : "null";
      posted.push(cast<Record<string, unknown>>(JSON.parse(raw), "body"));
      return Promise.resolve(
        new Response(JSON.stringify(responseBody(type)), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    },
    { preconnect: fetch.preconnect },
  );

type Harness = {
  readonly client: ExchangeClient;
  readonly posted: Record<string, unknown>[];
  readonly digests: { digest: Digest32; envelope: DigestEnvelope }[];
};

const harness = (type: ResponseType): Harness => {
  const posted: Record<string, unknown>[] = [];
  const digests: { digest: Digest32; envelope: DigestEnvelope }[] = [];
  const transport = new Transport({ fetchImpl: fakeFetch(posted, type) });
  const signer = new Signer({ privateKey: bytesFromHex(PRIVATE_KEY_HEX) });
  const client = new ExchangeClient({
    transport,
    signer,
    builders: new Map([[ADDRESS.toLowerCase(), 10]]),
    onDigest: (digest, envelope) => {
      digests.push({ digest, envelope });
    },
  });
  return { client, posted, digests };
};

const bodyOf = (posted: readonly Record<string, unknown>[]): Record<string, unknown> => {
  const body = posted[0];
  if (body === undefined) throw new Error("transport did not post a body");
  return body;
};

const actionOf = (body: Record<string, unknown>): Record<string, unknown> =>
  cast<Record<string, unknown>>(body["action"], "action");

const signatureOf = (body: Record<string, unknown>): Record<string, unknown> =>
  cast<Record<string, unknown>>(body["signature"], "signature");

const requireFirst = <T>(items: readonly T[]): T => {
  const [first] = items;
  if (first === undefined) throw new Error("expected at least one item");
  return first;
};

const assertChainFields = (
  wireCase: WireCase,
  body: Record<string, unknown>,
  action: Record<string, unknown>,
): void => {
  if (wireCase.kind === "l1") {
    expect(typeof body["nonce"]).toBe("number");
    return;
  }
  expect(typeof action["hyperliquidChain"]).toBe("string");
  expect(typeof action["signatureChainId"]).toBe("string");
};

const rejectionMessage = (promise: Promise<unknown>): Promise<string> =>
  promise.then(
    () => "resolved",
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );

const isRecoveryId = (value: unknown): value is 27 | 28 => value === 27 || value === 28;

describe("ExchangeClient wire contract", () => {
  test("the table covers every public method exactly once", () => {
    const methods = new Set(CASES.map((entry) => entry.method));
    expect(CASES.length).toBe(48);
    expect(methods.size).toBe(CASES.length);
  });

  for (const c of CASES) {
    test(`${c.method} posts ${c.wireType} with a signed envelope`, async () => {
      const h = harness(c.responseType);
      const ok = await c.call(h.client);
      expect(ok.status).toBe("ok");
      expect(h.posted.length).toBe(1);

      const body = bodyOf(h.posted);
      const action = actionOf(body);
      expect(action["type"]).toBe(c.wireType);
      expect(Object.keys(action)[0]).toBe("type");

      expect(typeof body["nonce"]).toBe("number");
      const signature = signatureOf(body);
      expect(signature["r"]).toMatch(/^0x[0-9a-f]{64}$/);
      expect(signature["s"]).toMatch(/^0x[0-9a-f]{64}$/);
      expect(isRecoveryId(signature["v"])).toBe(true);

      assertChainFields(c, body, action);

      expect(h.digests.length).toBe(1);
      const record = requireFirst(h.digests);
      expect(record.digest).toBeInstanceOf(Uint8Array);
      expect(record.digest.length).toBe(32);
      const envelopeAction = cast<Record<string, unknown>>(
        record.envelope.action,
        "envelope.action",
      );
      expect(envelopeAction["type"]).toBe(c.wireType);
      expect(body["nonce"]).toBe(record.envelope.nonce);
    });
  }

  test("a default reply for order crosses the expected response type", async () => {
    const h = harness("default");
    expect(await rejectionMessage(h.client.order(sampleOf("order")))).toMatch(
      /did not match submitted order/,
    );
  });

  test("a default reply for updateLeverage resolves", async () => {
    const h = harness("default");
    const ok = await h.client.updateLeverage(sampleOf("updateLeverage"));
    expect(ok.status).toBe("ok");
    expect(ok.response.type).toBe("default");
  });
});
