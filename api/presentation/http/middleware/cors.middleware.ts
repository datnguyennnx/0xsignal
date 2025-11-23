import type { ServerResponse } from "node:http";

export const applyCors = (res: ServerResponse, requestId: string) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("X-Request-ID", requestId);
};

export const handleOptionsRequest = (res: ServerResponse): boolean => {
  res.writeHead(204);
  res.end();
  return true;
};
