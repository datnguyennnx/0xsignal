import { Effect } from "effect";

export const healthRoute = () =>
  Effect.succeed({
    status: "ok",
    timestamp: new Date(),
    uptime: (globalThis as any).process?.uptime?.() || 0,
  });
