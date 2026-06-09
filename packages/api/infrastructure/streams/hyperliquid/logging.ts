// Bridge Pattern: Module-scope config
// process.env.MODE is read at module scope because marketWsLog must be a
// plain synchronous function (used in non-Effect callbacks from
// WebSocket/event-emitter contexts). A proper Config-based approach would
// require making the entire log path Effect-aware, which is not justified
// for a debug-level logging toggle.
//
// This is an acceptable bridge pattern — documented as such.
const MARKET_WS_DEBUG_LOGS_ENABLED = process.env.MODE === "dev";

export const marketWsLog = (
  event: string,
  fields: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info"
) => {
  // Bridge Pattern: new Date() in sync context
  // marketWsLog is a plain sync function used in non-Effect callbacks
  // (WebSocket event handlers, pool event listeners). Clock.currentTimeMillis
  // would require Effect-based execution. For a debug-level logging function,
  // new Date().toISOString() is the correct approach in this sync boundary.
  const payload = {
    scope: "market-ws",
    event,
    ...fields,
    ts: new Date().toISOString(),
  };

  if (level === "error") {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === "warn") {
    console.warn(JSON.stringify(payload));
    return;
  }

  if (!MARKET_WS_DEBUG_LOGS_ENABLED) {
    return;
  }

  console.info(JSON.stringify(payload));
};
