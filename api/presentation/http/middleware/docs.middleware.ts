import type { IncomingMessage, ServerResponse } from "node:http";
import { swaggerSpec } from "../../../infrastructure/docs/swagger.config";

const generateSwaggerHTML = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>0xSignal API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui.css">
  <style>body { margin: 0; padding: 0; } .swagger-ui .topbar { display: none; }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;

export const handleDocsRequest = (
  pathname: string,
  _req: IncomingMessage,
  res: ServerResponse
): boolean => {
  // Serve Swagger UI HTML
  if (pathname === "/api/docs" || pathname === "/api/docs/") {
    res.setHeader("Content-Type", "text/html");
    res.writeHead(200);
    res.end(generateSwaggerHTML());
    return true;
  }

  // Serve OpenAPI JSON spec
  if (pathname === "/api/docs.json") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify(swaggerSpec, null, 2));
    return true;
  }

  return false;
};
