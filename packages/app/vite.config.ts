import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react({
      // SWC is 60× faster than Babel - no need for babel-plugin-react-compiler
      devTarget: "esnext",
    }),
    tailwindcss(),
    // Bundle analyzer - run with `bun run build` to see stats.html
    visualizer({
      filename: "dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    // Warm up frequently used files for instant reloads
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/features/chart/components/trading-chart/index.tsx",
        "./src/features/asset-detail/pages/asset-detail.tsx",
      ],
    },
    proxy: {
      "/api": { target: "http://localhost:9006", changeOrigin: true },
    },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    cssMinify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    cssCodeSplit: true,
    modulePreload: { polyfill: false },
    reportCompressedSize: false,
    // Enhanced rollup options for better code splitting
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        // Optimized manual chunks for parallel loading
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "chart-vendor": ["lightweight-charts", "echarts", "echarts-for-react", "recharts"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-slot",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-select",
            "lucide-react",
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
          ],
          "crypto-vendor": ["viem", "wagmi", "@rainbow-me/rainbowkit"],
          "query-vendor": ["@tanstack/react-query"],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "react-dom",
      "react-dom/client",
      "react-router-dom",
      "lightweight-charts",
      "@tanstack/react-query",
      "viem",
      "wagmi",
    ],
    // Faster dependency pre-bundling
    holdUntilCrawlEnd: false,
    esbuildOptions: {
      target: "esnext",
      supported: {
        "top-level-await": true,
      },
    },
  },
  esbuild: {
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
    target: "esnext",
    legalComments: "none",
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    treeShaking: true,
  },
});
