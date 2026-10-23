import { ExchangeAccountRepo, ExchangeCredentialRepo, type AuthService } from "@0xsignal/auth";
import type { HealthService } from "../../application/health";
import type { MarketDataService } from "../../application/market-data/contracts";
import type { UserDataService } from "../../application/user-data/contracts";
import type { ExchangeService } from "../../application/exchange/contracts";
import type { HyperliquidClient } from "../../application/hyperliquid/contracts";
import type { CredentialVerifier } from "../../application/hyperliquid/credential-verification";
import type { MarketStreamHub } from "../../application/market-data/market-stream.contracts";

/**
 * Everything an HTTP request effect may require. AppLayer provides all of it;
 * the type is named once here so the layer and its consumers agree without
 * widening assertions.
 */
export type RequestEnvironment =
  | AuthService
  | ExchangeAccountRepo
  | ExchangeCredentialRepo
  | HyperliquidClient
  | CredentialVerifier
  | HealthService
  | MarketDataService
  | UserDataService
  | ExchangeService
  | MarketStreamHub;
