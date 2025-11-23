#!/usr/bin/env tsx

import { Effect } from "effect";
import { AppConfig } from "./infrastructure/config/app.config";
import { AppLayer } from "./infrastructure/layers/app.layer";
import { Logger } from "./infrastructure/logging/logger.service";
import { runAnalysis } from "./application/use-cases/analyze-market";
import { runMonitoring } from "./application/use-cases/monitor-market";

// CLI command type
type Command = "analyze" | "monitor";

// Parse CLI arguments
const parseCommand = (args: string[]): Command => {
  const command = args[2];

  switch (command) {
    case "monitor":
    case "continuous":
      return "monitor";
    case "analyze":
    case "single":
    default:
      return "analyze";
  }
};

// Main application entry point
const main = Effect.gen(function* () {
  const logger = yield* Logger;

  // Load configuration
  const config = yield* AppConfig;

  // Parse command from CLI args
  const args = (globalThis as { process?: { argv: string[] } }).process?.argv || [];
  const command = parseCommand(args);

  yield* logger.info(`Starting in ${command} mode`);

  // Select and run the appropriate program
  if (command === "monitor") {
    return yield* runMonitoring(config);
  } else {
    return yield* runAnalysis(config);
  }
});

// Run the application with all layers
const program = main.pipe(Effect.provide(AppLayer)) as Effect.Effect<any, any, never>;

Effect.runPromise(program).catch((error) => {
  console.error("Fatal error:", error);
  (globalThis as { process?: { exit: (code: number) => void } }).process?.exit(1);
});
