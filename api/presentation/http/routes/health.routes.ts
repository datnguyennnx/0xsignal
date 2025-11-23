import { Effect } from "effect";

/**
 * @openapi
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check endpoint
 *     description: Returns the health status of the API server
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
export const healthRoute = () =>
  Effect.succeed({
    status: "ok",
    timestamp: new Date(),
    uptime: (globalThis as any).process?.uptime?.() || 0,
  });
