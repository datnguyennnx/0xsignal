import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const ReactCompilerConfig = { target: "19" };

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", ReactCompilerConfig]],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom", "effect"],
  },
  server: {
    proxy: {
      "/api": { target: "http://localhost:9006", changeOrigin: true },
    },
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/App.tsx",
        "./src/core/runtime/effect-runtime.ts",
        "./src/core/cache/effect-cache.ts",
      ],
    },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    cssMinify: "lightningcss",
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "effect-vendor": ["effect"],
          "chart-vendor": ["echarts", "echarts-for-react"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-slot",
          ],
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
      "react-router-dom",
      "effect",
      "effect/Effect",
      "effect/Layer",
      "effect/Cache",
      "effect/Duration",
      "effect/Runtime",
      "effect/Fiber",
      "effect/Exit",
      "effect/Schedule",
      "effect/Option",
      "effect/ManagedRuntime",
      "@effect/platform",
      "@effect/schema",
    ],
  },
  esbuild: {
    drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
    target: "esnext",
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
    keepNames: true,
    treeShaking: true,
  },
});
