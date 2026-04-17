/** HTTP Router - Route matching with functional patterns */

import { Effect } from "effect";
import { healthRoute } from "./routes/health.routes";

const notFound = Effect.fail({ status: 404, message: "Not found" });

// Main router - returns Effect with any requirements
export const handleRequest = (url: URL) => {
  const path = url.pathname;

  // Static routes
  switch (path) {
    case "/api/health":
      return healthRoute();
  }

  return notFound;
};
