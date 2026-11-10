import path from "path";
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, "");
  const analyze = process.env.ANALYZE === "true";
  return {
    root: import.meta.dirname,
    plugins: [
      react(),
      tailwindcss(),
      contentSecurityPolicy(buildContentSecurityPolicy(env.VITE_API_URL)),
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
        "@nktkas/hyperliquid",
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
                name: "vendor-lightweight-charts",
                test: /node_modules[\\/]lightweight-charts[\\/]/,
                priority: 30,
                minSize: 20_000,
              },
              {
                name: "vendor-recharts",
                test: /node_modules[\\/](recharts|victory-vendor|react-smooth|decimal\.js-light|es-toolkit|d3-[^\\/]+)[\\/]/,
                priority: 25,
                minSize: 20_000,
                includeDependenciesRecursively: false,
              },
              {
                name: "vendor-katex",
                test: /node_modules[\\/](katex|react-katex)[\\/]/,
                priority: 20,
                minSize: 20_000,
              },
              {
                name: "vendor-viem-wagmi",
                test: /node_modules[\\/](viem|wagmi)[\\/]/,
                priority: 10,
                minSize: 20_000,
              },
              {
                name: "vendor-react",
                test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
                priority: 100,
                minSize: 20_000,
              },
            ],
          },
        },
      },
    },
  };
});
