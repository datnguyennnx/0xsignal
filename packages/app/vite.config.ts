import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react({
      devTarget: "esnext",
    }),
    tailwindcss(),
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
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
    cssCodeSplit: true,
    reportCompressedSize: false,
    // Rolldown in Vite 8 handles chunk splitting automatically
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
      "react-dom",
      "react-router-dom",
      "lightweight-charts",
      "@tanstack/react-query",
      "viem",
      "wagmi",
    ],
  },
});
