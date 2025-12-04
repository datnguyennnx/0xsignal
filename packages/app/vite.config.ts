import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// React Compiler config for React 19.2
const ReactCompilerConfig = {
  target: "19", // React 19.2 target
};

// https://vite.dev/config/
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
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Dedupe to prevent multiple instances
    dedupe: ["react", "react-dom", "effect"],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:9006",
        changeOrigin: true,
      },
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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
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
      // Pre-bundle Effect-TS core for faster dev startup
      "effect",
      "effect/Effect",
      "effect/Layer",
      "effect/Cache",
      "effect/Duration",
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
    // Preserve Effect-TS generator functions
    keepNames: true,
  },
});
