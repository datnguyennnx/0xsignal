/** Health Routes */

import { HealthServices } from "../../../application/health";

type HealthHttpService = {
  readonly check: (typeof HealthServices.Service)["check"];
};

export const healthRoute = (health: HealthHttpService) => health.check();
