/** Health Routes */

import { HealthService } from "../../../application/health";

type HealthHttpService = {
  readonly check: (typeof HealthService.Service)["check"];
};

export const healthRoute = (health: HealthHttpService) => health.check();
