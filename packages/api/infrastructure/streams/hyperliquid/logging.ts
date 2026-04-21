import { IS_DEV_MODE } from "../../config/mode";

const MARKET_WS_DEBUG_LOGS_ENABLED = IS_DEV_MODE;

export const marketWsLog = (
  event: string,
  fields: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info"
) => {
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
