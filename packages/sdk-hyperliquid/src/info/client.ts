/**
 * @hyperliquid-api POST /info
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint.md
 */

import { arr, cast, obj } from "../core/parse";
import type { Transport } from "../core/transport";
import { infoWeight } from "../core/weight";
import {
  parseAllMids,
  parseCandleSnapshot,
  parseClearinghouseState,
  parseHistoricalOrders,
  parseL2Book,
  parseMaxBuilderFee,
  parseMeta,
  parseMetaAndAssetCtxs,
  parseOrderStatus,
  parseSpotClearinghouseState,
  parseSpotMetaAndAssetCtxs,
  parseUnknown,
  parseUserAbstraction,
  parseUserDexAbstraction,
  parseUserFills,
  parseUserFunding,
} from "./parse";
import type {
  AllBorrowLendReserveStatesInfoRequest,
  AllBorrowLendReserveStatesInfoResponse,
  AllMidsInfoRequest,
  AllMidsInfoResponse,
  ActiveAssetDataInfoRequest,
  ActiveAssetDataInfoResponse,
  AllPerpMetasInfoRequest,
  AllPerpMetasInfoResponse,
  ApprovedBuildersInfoRequest,
  ApprovedBuildersInfoResponse,
  BorrowLendReserveStateInfoRequest,
  BorrowLendReserveStateInfoResponse,
  BorrowLendUserStateInfoRequest,
  BorrowLendUserStateInfoResponse,
  CandleSnapshotInfoRequest,
  CandleSnapshotInfoResponse,
  ClearinghouseStateInfoRequest,
  ClearinghouseStateInfoResponse,
  DelegationsInfoRequest,
  DelegationsInfoResponse,
  DelegatorHistoryInfoRequest,
  DelegatorHistoryInfoResponse,
  DelegatorRewardsInfoRequest,
  DelegatorRewardsInfoResponse,
  DelegatorSummaryInfoRequest,
  DelegatorSummaryInfoResponse,
  FrontendOpenOrdersInfoRequest,
  FrontendOpenOrdersInfoResponse,
  FundingHistoryInfoRequest,
  FundingHistoryInfoResponse,
  HistoricalOrdersInfoRequest,
  HistoricalOrdersInfoResponse,
  L2BookInfoRequest,
  L2BookInfoResponse,
  MaxBuilderFeeInfoRequest,
  MaxBuilderFeeInfoResponse,
  MetaAndAssetCtxsInfoRequest,
  MetaAndAssetCtxsInfoResponse,
  MetaInfoRequest,
  MetaInfoResponse,
  OpenOrdersInfoRequest,
  OpenOrdersInfoResponse,
  OrderStatusInfoRequest,
  OrderStatusInfoResponse,
  PerpAnnotationInfoRequest,
  PerpAnnotationInfoResponse,
  PerpCategoriesInfoRequest,
  PerpCategoriesInfoResponse,
  PerpConciseAnnotationsInfoRequest,
  PerpConciseAnnotationsInfoResponse,
  PerpDeployAuctionStatusInfoRequest,
  PerpDeployAuctionStatusInfoResponse,
  PerpDexLimitsInfoRequest,
  PerpDexLimitsInfoResponse,
  PerpDexsInfoRequest,
  PerpDexsInfoResponse,
  PerpDexStatusInfoRequest,
  PerpDexStatusInfoResponse,
  PerpsAtOpenInterestCapInfoRequest,
  PerpsAtOpenInterestCapInfoResponse,
  PortfolioInfoRequest,
  PortfolioInfoResponse,
  PredictedFundingsInfoRequest,
  PredictedFundingsInfoResponse,
  ReferralInfoRequest,
  ReferralInfoResponse,
  SpotClearinghouseStateInfoRequest,
  SpotClearinghouseStateInfoResponse,
  SpotDeployStateInfoRequest,
  SpotDeployStateInfoResponse,
  SpotMetaAndAssetCtxsInfoRequest,
  SpotMetaAndAssetCtxsInfoResponse,
  SpotMetaInfoRequest,
  SpotMetaInfoResponse,
  SpotOutcomeDeployerLimitsInfoRequest,
  SpotOutcomeDeployerLimitsInfoResponse,
  SpotOutcomeMetaInfoRequest,
  SpotOutcomeMetaInfoResponse,
  SpotOutcomeTemplatesInfoRequest,
  SpotOutcomeTemplatesInfoResponse,
  SpotPairDeployAuctionStatusInfoRequest,
  SpotPairDeployAuctionStatusInfoResponse,
  SpotSettledOutcomeInfoRequest,
  SpotSettledOutcomeInfoResponse,
  SpotTokenDetailsInfoRequest,
  SpotTokenDetailsInfoResponse,
  SubAccountsInfoRequest,
  SubAccountsInfoResponse,
  UserAbstractionInfoRequest,
  UserAbstractionInfoResponse,
  UserDexAbstractionInfoRequest,
  UserDexAbstractionInfoResponse,
  UserFeesInfoRequest,
  UserFeesInfoResponse,
  UserFillsByTimeInfoRequest,
  UserFillsByTimeInfoResponse,
  UserFillsInfoRequest,
  UserFillsInfoResponse,
  UserFundingInfoRequest,
  UserFundingInfoResponse,
  UserNonFundingLedgerUpdatesInfoRequest,
  UserNonFundingLedgerUpdatesInfoResponse,
  UserRateLimitInfoRequest,
  UserRateLimitInfoResponse,
  UserRoleInfoRequest,
  UserRoleInfoResponse,
  UserTwapSliceFillsInfoRequest,
  UserTwapSliceFillsInfoResponse,
  UserVaultEquitiesInfoRequest,
  UserVaultEquitiesInfoResponse,
  VaultDetailsInfoRequest,
  VaultDetailsInfoResponse,
} from "./types";
import type { UserStarStateInfoRequest } from "./types/perp";

const arrayOf =
  <T>(key: string) =>
  (u: unknown): T =>
    cast<T>(arr(u, key), key);

const objectOf =
  <T>(key: string) =>
  (u: unknown): T =>
    cast<T>(obj(u, key), key);

const parseOpenOrders = arrayOf<OpenOrdersInfoResponse>("openOrders");
const parseFrontendOpenOrders = arrayOf<FrontendOpenOrdersInfoResponse>("frontendOpenOrders");
const parseUserFillsByTime = arrayOf<UserFillsByTimeInfoResponse>("userFillsByTime");
const parseUserRateLimit = objectOf<UserRateLimitInfoResponse>("userRateLimit");
const parseUserTwapSliceFills = arrayOf<UserTwapSliceFillsInfoResponse>("userTwapSliceFills");
const parseSubAccounts = arrayOf<SubAccountsInfoResponse>("subAccounts");
const parseVaultDetails = objectOf<VaultDetailsInfoResponse>("vaultDetails");
const parseUserVaultEquities = arrayOf<UserVaultEquitiesInfoResponse>("userVaultEquities");
const parseUserRole = objectOf<UserRoleInfoResponse>("userRole");
const parsePortfolio = arrayOf<PortfolioInfoResponse>("portfolio");
const parseReferral = objectOf<ReferralInfoResponse>("referral");
const parseUserFees = objectOf<UserFeesInfoResponse>("userFees");
const parseDelegations = arrayOf<DelegationsInfoResponse>("delegations");
const parseDelegatorSummary = objectOf<DelegatorSummaryInfoResponse>("delegatorSummary");
const parseDelegatorHistory = arrayOf<DelegatorHistoryInfoResponse>("delegatorHistory");
const parseDelegatorRewards = arrayOf<DelegatorRewardsInfoResponse>("delegatorRewards");
const parseBorrowLendUserState = objectOf<BorrowLendUserStateInfoResponse>("borrowLendUserState");
const parseBorrowLendReserveState =
  objectOf<BorrowLendReserveStateInfoResponse>("borrowLendReserveState");
const parseAllBorrowLendReserveStates = arrayOf<AllBorrowLendReserveStatesInfoResponse>(
  "allBorrowLendReserveStates",
);
const parseApprovedBuilders = arrayOf<ApprovedBuildersInfoResponse>("approvedBuilders");
const parsePerpDexs = arrayOf<PerpDexsInfoResponse>("perpDexs");
const parseUserNonFundingLedgerUpdates = arrayOf<UserNonFundingLedgerUpdatesInfoResponse>(
  "userNonFundingLedgerUpdates",
);
const parseFundingHistory = arrayOf<FundingHistoryInfoResponse>("fundingHistory");
const parsePredictedFundings = arrayOf<PredictedFundingsInfoResponse>("predictedFundings");
const parsePerpsAtOpenInterestCap =
  arrayOf<PerpsAtOpenInterestCapInfoResponse>("perpsAtOpenInterestCap");
const parsePerpDeployAuctionStatus =
  objectOf<PerpDeployAuctionStatusInfoResponse>("perpDeployAuctionStatus");
const parseActiveAssetData = objectOf<ActiveAssetDataInfoResponse>("activeAssetData");
const parsePerpDexLimits = objectOf<PerpDexLimitsInfoResponse>("perpDexLimits");
const parsePerpDexStatus = objectOf<PerpDexStatusInfoResponse>("perpDexStatus");
const parseAllPerpMetas = arrayOf<AllPerpMetasInfoResponse>("allPerpMetas");
const parsePerpAnnotation = objectOf<PerpAnnotationInfoResponse>("perpAnnotation");
const parsePerpCategories = arrayOf<PerpCategoriesInfoResponse>("perpCategories");
const parsePerpConciseAnnotations =
  arrayOf<PerpConciseAnnotationsInfoResponse>("perpConciseAnnotations");
const parseSpotMeta = objectOf<SpotMetaInfoResponse>("spotMeta");
const parseSpotDeployState = objectOf<SpotDeployStateInfoResponse>("spotDeployState");
const parseSpotPairDeployAuctionStatus = objectOf<SpotPairDeployAuctionStatusInfoResponse>(
  "spotPairDeployAuctionStatus",
);
const parseSpotTokenDetails = objectOf<SpotTokenDetailsInfoResponse>("tokenDetails");
const parseSpotOutcomeMeta = objectOf<SpotOutcomeMetaInfoResponse>("outcomeMeta");
const parseSpotOutcomeTemplates = arrayOf<SpotOutcomeTemplatesInfoResponse>("outcomeTemplates");
const parseSpotSettledOutcome = objectOf<SpotSettledOutcomeInfoResponse>("settledOutcome");
const parseSpotOutcomeDeployerLimits =
  objectOf<SpotOutcomeDeployerLimitsInfoResponse>("outcomeDeployerLimits");

export function infoBody(type: string, params: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = { type };
  for (const key of Object.keys(params)) {
    if (key !== "type") body[key] = params[key];
  }
  return body;
}

function postParsed<T>(
  transport: Transport,
  type: string,
  params: Record<string, unknown>,
  parse: (u: unknown) => T,
): Promise<T> {
  return transport.postInfo(infoBody(type, params), parse, infoWeight(type, 0));
}

export class InfoClient {
  private readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  allMids(params: Omit<AllMidsInfoRequest, "type">): Promise<AllMidsInfoResponse> {
    return postParsed(this.transport, "allMids", params, parseAllMids);
  }

  openOrders(params: Omit<OpenOrdersInfoRequest, "type">): Promise<OpenOrdersInfoResponse> {
    return postParsed(this.transport, "openOrders", params, parseOpenOrders);
  }

  frontendOpenOrders(
    params: Omit<FrontendOpenOrdersInfoRequest, "type">,
  ): Promise<FrontendOpenOrdersInfoResponse> {
    return postParsed(this.transport, "frontendOpenOrders", params, parseFrontendOpenOrders);
  }

  userFills(params: Omit<UserFillsInfoRequest, "type">): Promise<UserFillsInfoResponse> {
    return postParsed(this.transport, "userFills", params, parseUserFills);
  }

  userFillsByTime(
    params: Omit<UserFillsByTimeInfoRequest, "type">,
  ): Promise<UserFillsByTimeInfoResponse> {
    return postParsed(this.transport, "userFillsByTime", params, parseUserFillsByTime);
  }

  userRateLimit(
    params: Omit<UserRateLimitInfoRequest, "type">,
  ): Promise<UserRateLimitInfoResponse> {
    return postParsed(this.transport, "userRateLimit", params, parseUserRateLimit);
  }

  orderStatus(params: Omit<OrderStatusInfoRequest, "type">): Promise<OrderStatusInfoResponse> {
    return postParsed(this.transport, "orderStatus", params, parseOrderStatus);
  }

  l2Book(params: Omit<L2BookInfoRequest, "type">): Promise<L2BookInfoResponse> {
    return postParsed(this.transport, "l2Book", params, parseL2Book);
  }

  candleSnapshot(
    params: Omit<CandleSnapshotInfoRequest, "type">,
  ): Promise<CandleSnapshotInfoResponse> {
    return postParsed(this.transport, "candleSnapshot", params, parseCandleSnapshot);
  }

  maxBuilderFee(
    params: Omit<MaxBuilderFeeInfoRequest, "type">,
  ): Promise<MaxBuilderFeeInfoResponse> {
    return postParsed(this.transport, "maxBuilderFee", params, parseMaxBuilderFee);
  }

  historicalOrders(
    params: Omit<HistoricalOrdersInfoRequest, "type">,
  ): Promise<HistoricalOrdersInfoResponse> {
    return postParsed(this.transport, "historicalOrders", params, parseHistoricalOrders);
  }

  userTwapSliceFills(
    params: Omit<UserTwapSliceFillsInfoRequest, "type">,
  ): Promise<UserTwapSliceFillsInfoResponse> {
    return postParsed(this.transport, "userTwapSliceFills", params, parseUserTwapSliceFills);
  }

  subAccounts(params: Omit<SubAccountsInfoRequest, "type">): Promise<SubAccountsInfoResponse> {
    return postParsed(this.transport, "subAccounts", params, parseSubAccounts);
  }

  vaultDetails(params: Omit<VaultDetailsInfoRequest, "type">): Promise<VaultDetailsInfoResponse> {
    return postParsed(this.transport, "vaultDetails", params, parseVaultDetails);
  }

  userVaultEquities(
    params: Omit<UserVaultEquitiesInfoRequest, "type">,
  ): Promise<UserVaultEquitiesInfoResponse> {
    return postParsed(this.transport, "userVaultEquities", params, parseUserVaultEquities);
  }

  userRole(params: Omit<UserRoleInfoRequest, "type">): Promise<UserRoleInfoResponse> {
    return postParsed(this.transport, "userRole", params, parseUserRole);
  }

  portfolio(params: Omit<PortfolioInfoRequest, "type">): Promise<PortfolioInfoResponse> {
    return postParsed(this.transport, "portfolio", params, parsePortfolio);
  }

  referral(params: Omit<ReferralInfoRequest, "type">): Promise<ReferralInfoResponse> {
    return postParsed(this.transport, "referral", params, parseReferral);
  }

  userFees(params: Omit<UserFeesInfoRequest, "type">): Promise<UserFeesInfoResponse> {
    return postParsed(this.transport, "userFees", params, parseUserFees);
  }

  delegations(params: Omit<DelegationsInfoRequest, "type">): Promise<DelegationsInfoResponse> {
    return postParsed(this.transport, "delegations", params, parseDelegations);
  }

  delegatorSummary(
    params: Omit<DelegatorSummaryInfoRequest, "type">,
  ): Promise<DelegatorSummaryInfoResponse> {
    return postParsed(this.transport, "delegatorSummary", params, parseDelegatorSummary);
  }

  delegatorHistory(
    params: Omit<DelegatorHistoryInfoRequest, "type">,
  ): Promise<DelegatorHistoryInfoResponse> {
    return postParsed(this.transport, "delegatorHistory", params, parseDelegatorHistory);
  }

  delegatorRewards(
    params: Omit<DelegatorRewardsInfoRequest, "type">,
  ): Promise<DelegatorRewardsInfoResponse> {
    return postParsed(this.transport, "delegatorRewards", params, parseDelegatorRewards);
  }

  userDexAbstraction(
    params: Omit<UserDexAbstractionInfoRequest, "type">,
  ): Promise<UserDexAbstractionInfoResponse> {
    return postParsed(this.transport, "userDexAbstraction", params, parseUserDexAbstraction);
  }

  userAbstraction(
    params: Omit<UserAbstractionInfoRequest, "type">,
  ): Promise<UserAbstractionInfoResponse> {
    return postParsed(this.transport, "userAbstraction", params, parseUserAbstraction);
  }

  borrowLendUserState(
    params: Omit<BorrowLendUserStateInfoRequest, "type">,
  ): Promise<BorrowLendUserStateInfoResponse> {
    return postParsed(this.transport, "borrowLendUserState", params, parseBorrowLendUserState);
  }

  borrowLendReserveState(
    params: Omit<BorrowLendReserveStateInfoRequest, "type">,
  ): Promise<BorrowLendReserveStateInfoResponse> {
    return postParsed(
      this.transport,
      "borrowLendReserveState",
      params,
      parseBorrowLendReserveState,
    );
  }

  allBorrowLendReserveStates(
    params: Omit<AllBorrowLendReserveStatesInfoRequest, "type">,
  ): Promise<AllBorrowLendReserveStatesInfoResponse> {
    return postParsed(
      this.transport,
      "allBorrowLendReserveStates",
      params,
      parseAllBorrowLendReserveStates,
    );
  }

  approvedBuilders(
    params: Omit<ApprovedBuildersInfoRequest, "type">,
  ): Promise<ApprovedBuildersInfoResponse> {
    return postParsed(this.transport, "approvedBuilders", params, parseApprovedBuilders);
  }

  perpDexs(params: Omit<PerpDexsInfoRequest, "type">): Promise<PerpDexsInfoResponse> {
    return postParsed(this.transport, "perpDexs", params, parsePerpDexs);
  }

  meta(params: Omit<MetaInfoRequest, "type">): Promise<MetaInfoResponse> {
    return postParsed(this.transport, "meta", params, parseMeta);
  }

  metaAndAssetCtxs(
    params: Omit<MetaAndAssetCtxsInfoRequest, "type">,
  ): Promise<MetaAndAssetCtxsInfoResponse> {
    return postParsed(this.transport, "metaAndAssetCtxs", params, parseMetaAndAssetCtxs);
  }

  clearinghouseState(
    params: Omit<ClearinghouseStateInfoRequest, "type">,
  ): Promise<ClearinghouseStateInfoResponse> {
    return postParsed(this.transport, "clearinghouseState", params, parseClearinghouseState);
  }

  userFunding(params: Omit<UserFundingInfoRequest, "type">): Promise<UserFundingInfoResponse> {
    return postParsed(this.transport, "userFunding", params, parseUserFunding);
  }

  userNonFundingLedgerUpdates(
    params: Omit<UserNonFundingLedgerUpdatesInfoRequest, "type">,
  ): Promise<UserNonFundingLedgerUpdatesInfoResponse> {
    return postParsed(
      this.transport,
      "userNonFundingLedgerUpdates",
      params,
      parseUserNonFundingLedgerUpdates,
    );
  }

  fundingHistory(
    params: Omit<FundingHistoryInfoRequest, "type">,
  ): Promise<FundingHistoryInfoResponse> {
    return postParsed(this.transport, "fundingHistory", params, parseFundingHistory);
  }

  predictedFundings(
    params: Omit<PredictedFundingsInfoRequest, "type">,
  ): Promise<PredictedFundingsInfoResponse> {
    return postParsed(this.transport, "predictedFundings", params, parsePredictedFundings);
  }

  perpsAtOpenInterestCap(
    params: Omit<PerpsAtOpenInterestCapInfoRequest, "type">,
  ): Promise<PerpsAtOpenInterestCapInfoResponse> {
    return postParsed(
      this.transport,
      "perpsAtOpenInterestCap",
      params,
      parsePerpsAtOpenInterestCap,
    );
  }

  perpDeployAuctionStatus(
    params: Omit<PerpDeployAuctionStatusInfoRequest, "type">,
  ): Promise<PerpDeployAuctionStatusInfoResponse> {
    return postParsed(
      this.transport,
      "perpDeployAuctionStatus",
      params,
      parsePerpDeployAuctionStatus,
    );
  }

  activeAssetData(
    params: Omit<ActiveAssetDataInfoRequest, "type">,
  ): Promise<ActiveAssetDataInfoResponse> {
    return postParsed(this.transport, "activeAssetData", params, parseActiveAssetData);
  }

  perpDexLimits(
    params: Omit<PerpDexLimitsInfoRequest, "type">,
  ): Promise<PerpDexLimitsInfoResponse> {
    return postParsed(this.transport, "perpDexLimits", params, parsePerpDexLimits);
  }

  perpDexStatus(
    params: Omit<PerpDexStatusInfoRequest, "type">,
  ): Promise<PerpDexStatusInfoResponse> {
    return postParsed(this.transport, "perpDexStatus", params, parsePerpDexStatus);
  }

  allPerpMetas(params: Omit<AllPerpMetasInfoRequest, "type">): Promise<AllPerpMetasInfoResponse> {
    return postParsed(this.transport, "allPerpMetas", params, parseAllPerpMetas);
  }

  perpAnnotation(
    params: Omit<PerpAnnotationInfoRequest, "type">,
  ): Promise<PerpAnnotationInfoResponse> {
    return postParsed(this.transport, "perpAnnotation", params, parsePerpAnnotation);
  }

  perpCategories(
    params: Omit<PerpCategoriesInfoRequest, "type">,
  ): Promise<PerpCategoriesInfoResponse> {
    return postParsed(this.transport, "perpCategories", params, parsePerpCategories);
  }

  perpConciseAnnotations(
    params: Omit<PerpConciseAnnotationsInfoRequest, "type">,
  ): Promise<PerpConciseAnnotationsInfoResponse> {
    return postParsed(
      this.transport,
      "perpConciseAnnotations",
      params,
      parsePerpConciseAnnotations,
    );
  }

  spotMeta(params: Omit<SpotMetaInfoRequest, "type">): Promise<SpotMetaInfoResponse> {
    return postParsed(this.transport, "spotMeta", params, parseSpotMeta);
  }

  spotMetaAndAssetCtxs(
    params: Omit<SpotMetaAndAssetCtxsInfoRequest, "type">,
  ): Promise<SpotMetaAndAssetCtxsInfoResponse> {
    return postParsed(this.transport, "spotMetaAndAssetCtxs", params, parseSpotMetaAndAssetCtxs);
  }

  spotClearinghouseState(
    params: Omit<SpotClearinghouseStateInfoRequest, "type">,
  ): Promise<SpotClearinghouseStateInfoResponse> {
    return postParsed(
      this.transport,
      "spotClearinghouseState",
      params,
      parseSpotClearinghouseState,
    );
  }

  spotDeployState(
    params: Omit<SpotDeployStateInfoRequest, "type">,
  ): Promise<SpotDeployStateInfoResponse> {
    return postParsed(this.transport, "spotDeployState", params, parseSpotDeployState);
  }

  spotPairDeployAuctionStatus(
    params: Omit<SpotPairDeployAuctionStatusInfoRequest, "type">,
  ): Promise<SpotPairDeployAuctionStatusInfoResponse> {
    return postParsed(
      this.transport,
      "spotPairDeployAuctionStatus",
      params,
      parseSpotPairDeployAuctionStatus,
    );
  }

  spotTokenDetails(
    params: Omit<SpotTokenDetailsInfoRequest, "type">,
  ): Promise<SpotTokenDetailsInfoResponse> {
    return postParsed(this.transport, "tokenDetails", params, parseSpotTokenDetails);
  }

  spotOutcomeMeta(
    params: Omit<SpotOutcomeMetaInfoRequest, "type">,
  ): Promise<SpotOutcomeMetaInfoResponse> {
    return postParsed(this.transport, "outcomeMeta", params, parseSpotOutcomeMeta);
  }

  spotOutcomeTemplates(
    params: Omit<SpotOutcomeTemplatesInfoRequest, "type">,
  ): Promise<SpotOutcomeTemplatesInfoResponse> {
    return postParsed(this.transport, "outcomeTemplates", params, parseSpotOutcomeTemplates);
  }

  spotSettledOutcome(
    params: Omit<SpotSettledOutcomeInfoRequest, "type">,
  ): Promise<SpotSettledOutcomeInfoResponse> {
    return postParsed(this.transport, "settledOutcome", params, parseSpotSettledOutcome);
  }

  spotOutcomeDeployerLimits(
    params: Omit<SpotOutcomeDeployerLimitsInfoRequest, "type">,
  ): Promise<SpotOutcomeDeployerLimitsInfoResponse> {
    return postParsed(
      this.transport,
      "outcomeDeployerLimits",
      params,
      parseSpotOutcomeDeployerLimits,
    );
  }

  recentTrades(params: { coin: string; from?: number; to?: number }): Promise<unknown> {
    return postParsed(this.transport, "recentTrades", params, parseUnknown);
  }

  twapHistory(params: { user: string }): Promise<unknown> {
    return postParsed(this.transport, "twapHistory", params, parseUnknown);
  }

  userTwapSliceFillsByTime(params: {
    user: string;
    startTime: number;
    endTime?: number;
  }): Promise<unknown> {
    return postParsed(this.transport, "userTwapSliceFillsByTime", params, parseUnknown);
  }

  validatorStats(params: { validator: string }): Promise<unknown> {
    return postParsed(this.transport, "validatorStats", params, parseUnknown);
  }

  userStarState(params: Omit<UserStarStateInfoRequest, "type">): Promise<unknown> {
    return postParsed(this.transport, "userStarState", params, parseUnknown);
  }

  exchangeStatus(params: Record<string, never>): Promise<unknown> {
    return postParsed(this.transport, "exchangeStatus", params, parseUnknown);
  }
}
