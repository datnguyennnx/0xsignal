import type {
  HyperliquidInternalError,
  HyperliquidValidationError,
  InsufficientMarginError,
} from "../../shared/errors";
import type {
  AccountNotFound,
  CredentialNotFound,
  CredentialRevoked,
  CredentialExpired,
  CredentialUnverified,
  EncryptionFailed,
} from "@0xsignal/auth";

export type ExchangeError =
  | HyperliquidValidationError
  | InsufficientMarginError
  | HyperliquidInternalError
  | AccountNotFound
  | CredentialNotFound
  | CredentialRevoked
  | CredentialExpired
  | CredentialUnverified
  | EncryptionFailed;
