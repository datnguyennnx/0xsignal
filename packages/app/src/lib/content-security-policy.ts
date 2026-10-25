const STATIC_CONNECT_SOURCES = [
  "https://api.hyperliquid.xyz",
  "wss://api.hyperliquid.xyz",
  "https://rpc.walletconnect.com",
  "wss://relay.walletconnect.com",
  "wss://relay.walletconnect.org",
  "https://*.llamarpc.com",
  "https://arb1.arbitrum.io",
];

/** Derives http and ws origins from the configured API URL; relative URLs keep `'self'`. */
function apiConnectSources(rawApiUrl: string | undefined): readonly string[] {
  const trimmed = rawApiUrl?.trim();
  if (trimmed === undefined || trimmed === "" || !/^https?:\/\//i.test(trimmed)) return [];
  const url = new URL(trimmed);
  const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
  return [url.origin, `${wsProtocol}//${url.host}`];
}

export function buildContentSecurityPolicy(rawApiUrl?: string): string {
  const connectSources = ["'self'", ...apiConnectSources(rawApiUrl), ...STATIC_CONNECT_SOURCES];
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https://app.hyperliquid.xyz https://*.walletconnect.com https://*.walletconnect.org",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSources.join(" ")}`,
    "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
