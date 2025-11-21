#!/usr/bin/env tsx

import { Effect, Config, Layer } from "effect";

// Configuration for the crypto signal application
const AppConfig = Config.all({
  coingeckoApiKey: Config.string("COINGECKO_API_KEY").pipe(Config.withDefault("")),
  monitoringInterval: Config.number("MONITORING_INTERVAL").pipe(Config.withDefault(5)),
  symbolsLimit: Config.number("SYMBOLS_LIMIT").pipe(Config.withDefault(20)),
  enableAlerts: Config.boolean("ENABLE_ALERTS").pipe(Config.withDefault(true)),
});

// Application layers (for future use when implementing full functionality)
const AppLayer = Layer.empty;

// Main bubble signal detection program
const bubbleSignalProgram = Effect.gen(function* () {
  yield* Effect.log("🚀 Starting 0xSignal - Crypto Bubble Detection System");

  yield* Effect.log("✅ System ready for bubble signal analysis");
  yield* Effect.log("💻 Use the web UI for real-time monitoring");
  yield* Effect.log("🔧 Use 'bun run backend:analyze' with real API integration");

  return { status: "ready", message: "System initialized successfully" };
});

// Continuous monitoring program
const continuousMonitoringProgram = Effect.gen(function* () {
  const config = yield* AppConfig;

  yield* Effect.log("🔄 Continuous monitoring is not yet implemented");
  yield* Effect.log(`   Configuration: ${config.symbolsLimit} symbols, ${config.monitoringInterval} minute intervals`);
  yield* Effect.log("💡 Use the web UI for manual monitoring or implement scheduled analysis");

  return { status: "not_implemented", message: "Continuous monitoring not yet implemented" };
});


// CLI argument parsing and program selection
const getProgramFromArgs = (args: string[]) => {
  const command = args[2]; // node main-crypto.ts <command>

  switch (command) {
    case "monitor":
    case "continuous":
      return { program: continuousMonitoringProgram, layer: AppLayer };
    case "single":
    case "analyze":
    default:
      return { program: bubbleSignalProgram, layer: AppLayer };
  }
};

// Main entry point
const main = Effect.gen(function* () {
  const args = (globalThis as { process?: { argv: string[] } }).process?.argv || [];

  const { program, layer } = getProgramFromArgs(args);

  const result = yield* Effect.provide(program, layer);

  yield* Effect.log("✅ Crypto bubble detection completed successfully");
  return result;
});

// Run the application
Effect.runPromise(main).catch((error) => {
  console.error("💥 Fatal error:", error);
  (globalThis as { process?: { exit: (code: number) => void } }).process?.exit(1);
});
