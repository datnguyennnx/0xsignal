import {
  getPortfolio,
  getUserFunding,
  getUserHistoricalOrders,
  getUserVaultEquities,
} from "./api/user";

/**
 * The backend routes a browser-direct Hyperliquid read falls back to.
 *
 * Both directions live here so `hl-rest-client` never imports the API layer and
 * the API layer never imports the client: this table is the only seam.
 */
export const backendReads = {
  portfolio: getPortfolio,
  userFunding: getUserFunding,
  userHistoricalOrders: getUserHistoricalOrders,
  userVaultEquities: getUserVaultEquities,
} as const;

/** Single rollback switch: set `enabled` to false to send every read via the backend again. */
const DIRECT_READS: { enabled: boolean } = { enabled: true };

/**
 * `classifyFailure` returns `null` when the error never reached Hyperliquid (so the
 * backend may answer instead), or the error to surface when the exchange did answer.
 */
export async function readWithFallback<T>(
  direct: () => Promise<T>,
  backend: () => Promise<T>,
  classifyFailure: (error: unknown) => Error | null,
): Promise<T> {
  if (!DIRECT_READS.enabled) return backend();
  try {
    return await direct();
  } catch (error) {
    const failure = classifyFailure(error);
    if (failure !== null) throw failure;
    return backend();
  }
}
