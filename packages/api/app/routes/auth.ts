import { buildAuthRoutes } from "@0xsignal/auth";
import type { Route } from "../../platform/http/route-contracts";
import type { HttpRequestServices } from "../contracts";
import { adaptAuthRoute } from "../defect-guard";

export const authRoutes: ReadonlyArray<Route<HttpRequestServices>> = buildAuthRoutes().map(
  (route) => ({
    method: route.method,
    path: route.path,
    handler: adaptAuthRoute(route.handler),
  }),
);
