import { Layer } from "effect";
import { AppLayer } from "./app/layers";
import { routes } from "./app/routes";
import { CorsServiceLayer } from "./platform/http/cors";
import { createRouter } from "./platform/http/router";

export { routes };
export { createWsSetup } from "./app/ws";

export const handleRequest = createRouter(routes);

export const appLayer = AppLayer.pipe(Layer.provideMerge(CorsServiceLayer));
