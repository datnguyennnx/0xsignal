import type { Route } from "../platform/http/route-contracts";
import type { HttpRequestServices } from "./contracts";
import { authRoutes } from "./routes/auth";
import { calendarRoutes } from "./routes/calendar";
import { credentialRoutes } from "./routes/credentials";
import { exchangeRoutes } from "./routes/exchange";
import { healthRoutes } from "./routes/health";
import { marketDataRoutes } from "./routes/market-data";
import { userDataRoutes } from "./routes/user-data";
import { whaleRoutes } from "./routes/whales";

type AppEnv = HttpRequestServices;

export const routes: Array<Route<AppEnv, unknown>> = [
  ...healthRoutes,
  ...marketDataRoutes,
  ...calendarRoutes,
  ...whaleRoutes,
  ...userDataRoutes,
  ...exchangeRoutes,
  ...credentialRoutes,
  ...authRoutes,
];
