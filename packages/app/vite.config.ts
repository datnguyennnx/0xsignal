import path from "path";
import { createHash } from "node:crypto";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { visualizer } from "rollup-plugin-visualizer";
import { buildContentSecurityPolicy } from "./src/lib/content-security-policy.ts";

function contentSecurityPolicy(policy: string): Plugin {
  return {
    name: "0xsignal-csp",
    transformIndexHtml(html, context) {
      if (context.server !== undefined) return html;
      return {
        html,
        tags: [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: policy },
            injectTo: "head-prepend",
          },
        ],
      };
    },
  };
}

/** Only an absolute origin can be pre-connected; a relative `/api` is the page's own origin. */
function apiOriginOf(rawApiUrl: string | undefined): string | null {
  const trimmed = rawApiUrl?.trim();
  if (trimmed === undefined || !/^https?:\/\//i.test(trimmed)) return null;
  return new URL(trimmed).origin;
}

function preconnectHints(rawApiUrl: string | undefined): Plugin {
  return {
    name: "0xsignal-preconnect",
    transformIndexHtml(html, context) {
      const origin = apiOriginOf(rawApiUrl);
      if (context.server !== undefined || origin === null) return html;
      return {
        html,
        tags: [
          {
            tag: "link",
            attrs: { rel: "preconnect", href: origin, crossorigin: "" },
            injectTo: "head",
          },
        ],
      };
    },
  };
}

/**
 * Route path → page module stem. Every entry is a prefix: `/trade/BTC` selects
 * `asset-detail`, and the longest matching prefix wins (`/whales/:address` beats
 * `/whales`). A path that matches nothing gets no preload at all.
 */
const ROUTE_PAGE_PREFIXES = {
  "/trade/": "asset-detail",
  "/auth/callback": "auth-callback",
  "/portfolio": "portfolio",
  "/whales/": "whale-detail",
  "/whales": "whales",
  "/calendar": "calendar",
  "/settings": "settings",
  "/login": "login",
} as const;

const PAGE_MODULE = /\/src\/pages\/([^/]+)\.tsx$/;

/**
 * Package name from a resolved module id, using the last `node_modules` segment
 * so bun's nested layout (`node_modules/.bun/viem@…/node_modules/viem/…`) and a
 * workspace symlink resolve to the same name.
 */
function packageNameOf(id: string): string | undefined {
  const parts = id.split(/[\\/]/);
  const index = parts.lastIndexOf("node_modules");
  if (index === -1) return undefined;
  const first = parts[index + 1];
  if (first === undefined) return undefined;
  if (!first.startsWith("@")) return first;
  const second = parts[index + 2];
  return second === undefined ? undefined : `${first}/${second}`;
}

/** Exact package-name matcher; a trailing `*` matches a package prefix. */
function packagesThat(...names: readonly string[]): (id: string) => boolean {
  const exact = new Set(names.filter((name) => !name.endsWith("*")));
  const prefixes = names.filter((name) => name.endsWith("*")).map((name) => name.slice(0, -1));
  return (id) => {
    const name = packageNameOf(id);
    if (name === undefined) return false;
    return exact.has(name) || prefixes.some((prefix) => name.startsWith(prefix));
  };
}

function moduleIdsOf(chunk: {
  moduleIds?: readonly string[];
  modules?: object;
}): readonly string[] {
  if (chunk.moduleIds !== undefined) return chunk.moduleIds;
  return chunk.modules === undefined ? [] : Object.keys(chunk.modules);
}

/**
 * Fetches the page chunk the URL needs before the entry module parses. The route
 * table lives in the bundle, not in the router, so the router lane can migrate
 * without the hint drifting.
 */
function routePreload(): Plugin {
  return {
    name: "0xsignal-route-preload",
    enforce: "post",
    generateBundle(_options, bundle) {
      const pageChunks = new Map<string, string>();
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const id of moduleIdsOf(output)) {
          const match = PAGE_MODULE.exec(id);
          if (match === null) continue;
          const stem = match[1];
          if (stem !== undefined && !pageChunks.has(stem)) pageChunks.set(stem, output.fileName);
        }
      }

      const entries = Object.entries(ROUTE_PAGE_PREFIXES)
        .map(([prefix, stem]) => [prefix, pageChunks.get(stem)] as const)
        .filter((entry): entry is readonly [string, string] => entry[1] !== undefined);
      if (entries.length === 0) return;

      const html = Object.values(bundle).find(
        (output) => output.type === "asset" && output.fileName === "index.html",
      );
      if (html === undefined || html.type !== "asset" || typeof html.source !== "string") return;

      // Longest prefix wins, so no link for an unknown path and one link for a known one.
      const table = `{${entries.map(([prefix, file]) => `"${prefix}":"${file}"`).join(",")}}`;
      const script = `(function(){var m=${table},p=location.pathname,b="",k;for(k in m){if(p.indexOf(k)===0&&k.length>b.length)b=k}if(!b)return;var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href="/"+m[b];document.head.appendChild(l)})()`;

      const hash = createHash("sha256").update(script).digest("base64");
      // The html serialiser escapes the directive's quotes, so accept both spellings.
      const scriptSrc = /(script-src )(?:'self'|&#39;self&#39;)/;
      html.source = html.source
        .replace(scriptSrc, `$1&#39;self&#39; &#39;sha256-${hash}&#39;`)
        .replace('<script type="module"', `<script>${script}</script><script type="module"`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const analyze = process.env.ANALYZE === "true";
  return {
    root: import.meta.dirname,
    plugins: [
      react(),
      tailwindcss(),
      contentSecurityPolicy(buildContentSecurityPolicy(env.VITE_API_URL)),
      preconnectHints(env.VITE_API_URL),
      routePreload(),
      ...(analyze
        ? [
            visualizer({
              filename: path.resolve(import.meta.dirname, "dist/stats.html"),
              projectRoot: import.meta.dirname,
              open: false,
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ],
    resolve: {
      dedupe: [
        "react",
        "react-dom",
        "react-router",
        "@tanstack/react-query",
        "zustand",
        "date-fns",
        "viem",
        "wagmi",
      ],
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
        "node:worker_threads": path.resolve(
          import.meta.dirname,
          "./src/lib/node-worker-threads-shim.ts",
        ),
      },
    },
    optimizeDeps: {
      holdUntilCrawlEnd: false,
      include: [
        "react",
        "react-dom",
        "react-router",
        "@tanstack/react-query",
        "zustand",
        "zustand/middleware",
        "viem",
        "viem/chains",
        "wagmi",
        "wagmi/chains",
        "wagmi/connectors",
        "lucide-react",
        "cn",
        "sonner",
        "date-fns",
        "class-variance-authority",
        "@0xsignal/sdk-hyperliquid",
        "@base-ui/react/button",
        "@base-ui/react/menu",
        "@base-ui/react/tooltip",
        "@base-ui/react/dialog",
        "@base-ui/react/avatar",
        "@base-ui/react/separator",
        "@base-ui/react/merge-props",
        "@base-ui/react/use-render",
      ],
    },
    server: {
      warmup: {
        clientFiles: [
          "./src/main.tsx",
          "./src/App.tsx",
          "./src/layouts/main-layout.tsx",
          "./src/components/app-side-panel.tsx",
          "./src/pages/asset-detail.tsx",
          "./src/pages/portfolio.tsx",
          "./src/pages/whales.tsx",
          "./src/pages/whale-detail.tsx",
          "./src/pages/calendar.tsx",
          "./src/pages/settings.tsx",
          "./src/pages/login.tsx",
          "./src/pages/auth-callback.tsx",
          "./src/pages/not-found.tsx",
          "./src/features/chart/components/trading-chart.tsx",
          "./src/features/asset-detail/components/asset-trading-grid.tsx",
          "./src/features/trade/components/orderbook-widget.tsx",
          "./src/features/trade/components/order-form.tsx",
          "./src/features/trade/components/positions-table.tsx",
          "./src/features/trade/components/open-orders-table.tsx",
          "./src/features/trade/components/order-history-table.tsx",
          "./src/features/trade/components/funding-history-table.tsx",
          "./src/features/trade/components/balance-table.tsx",
        ],
      },
      proxy: {
        "/api": { target: "http://localhost:9006", changeOrigin: true, ws: true },
      },
    },
    preview: {
      proxy: {
        "/api": { target: "http://localhost:9006", changeOrigin: true, ws: true },
      },
    },
    build: {
      target: "esnext",
      cssTarget: ["chrome111", "firefox128", "safari16.4"],
      sourcemap: false,
      cssCodeSplit: true,
      reportCompressedSize: true,
      manifest: true,
      // The error illustration must render even when the origin is unreachable,
      // so it cannot be a network fetch: inline it as a data URI instead.
      // Vite dev never inlines (modules/assets ship over HTTP), so this only
      // takes effect under `bun run start` / a production build; in dev, killing
      // the server breaks every asset by design.
      assetsInlineLimit: 8192,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "vendor-react",
                test: packagesThat("react", "react-dom", "react-router", "scheduler"),
                priority: 100,
                minSize: 20_000,
              },
              {
                name: "vendor-lightweight-charts",
                test: packagesThat("lightweight-charts"),
                priority: 30,
                minSize: 20_000,
              },
              {
                name: "vendor-recharts",
                test: packagesThat(
                  "recharts",
                  "victory-vendor",
                  "react-smooth",
                  "decimal.js-light",
                  "es-toolkit",
                  "d3-*",
                ),
                priority: 25,
                minSize: 20_000,
                includeDependenciesRecursively: false,
              },
              {
                name: "vendor-data",
                test: packagesThat("@tanstack/query-core", "@tanstack/react-query", "zustand"),
                priority: 15,
                minSize: 20_000,
                includeDependenciesRecursively: false,
              },
              {
                name: "vendor-ui",
                test: packagesThat(
                  "@base-ui/*",
                  "sonner",
                  "class-variance-authority",
                  "tailwind-merge",
                  "clsx",
                  "lucide-react",
                ),
                priority: 14,
                minSize: 20_000,
                entriesAware: true,
                includeDependenciesRecursively: false,
              },
              {
                name: "vendor-viem-wagmi",
                test: packagesThat(
                  "viem",
                  "wagmi",
                  "@wagmi/*",
                  "@noble/*",
                  "@scure/*",
                  "abitype",
                  "ox",
                ),
                priority: 10,
                minSize: 20_000,
                entriesAware: true,
                includeDependenciesRecursively: false,
              },
            ],
          },
        },
      },
    },
  };
});
