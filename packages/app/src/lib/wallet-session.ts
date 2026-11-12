/**
 * Mirrors `hasWalletSession` from `config/web3`, which cannot be imported by the
 * entry graph: that module statically owns the wagmi config, so importing it
 * would put the wallet chunk back on the entry chain. Keys are the ones wagmi
 * persists.
 */
const WALLET_HINT_KEYS = ["wagmi.store", "wagmi.recentConnectorId"] as const;

/** True when wagmi's storage still holds a session; safe outside the browser. */
export function hasWalletSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return WALLET_HINT_KEYS.some((key) => window.localStorage.getItem(key) !== null);
  } catch {
    return false;
  }
}
