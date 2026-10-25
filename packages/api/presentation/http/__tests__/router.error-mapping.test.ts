import { describe, expect, it } from "vitest";
import { Effect, Layer } from "effect";
import { MarketDataService } from "../../../application/market-data/contracts";
import { HealthService } from "../../../application/health";
import { UserDataService } from "../../../application/user-data/contracts";
import { ExchangeService } from "../../../application/exchange/contracts";
import { asHttpError } from "../error-response";
import { handleRequest } from "../router";
import { routes } from "../route-table";
import { injectUnhandledFailure, TestRouteEnvLayer } from "./route-test-layer";

const TestServices = Layer.mergeAll(
  Layer.mock(MarketDataService, {}),
  Layer.mock(HealthService, {}),
  Layer.mock(UserDataService, {}),
  Layer.mock(ExchangeService, {}),
  TestRouteEnvLayer,
);

const TEST_PATH = "/__test__/throw";

type HandlerFailure = ReturnType<(typeof routes)[number]["handler"]>;

// The well-formed case flows through this statically typed entry point.
const requestWithHandlerFailure = async (handlerFailure: HandlerFailure): Promise<Response> => {
  routes.push({ method: "GET", path: TEST_PATH, handler: () => handlerFailure });
  try {
    return await Effect.runPromise(
      handleRequest(new Request(`http://localhost${TEST_PATH}`, { method: "GET" })).pipe(
        Effect.provide(TestServices),
      ),
    );
  } finally {
    routes.pop();
  }
};

// Simulates a runtime failure that bypasses the handler's declared error type.
const requestWithUnhandledFailure = (failure: unknown): Promise<Response> =>
  requestWithHandlerFailure(injectUnhandledFailure(failure));

const bodyOf = async (response: Response): Promise<Record<string, unknown>> => {
  const parsed: unknown = await response.json();
  return typeof parsed === "object" && parsed !== null ? { ...parsed } : {};
};

describe("HTTP router error mapping", () => {
  it("uses the status of a well-formed HttpError", async () => {
    expect.hasAssertions();
    const response = await requestWithHandlerFailure(
      Effect.fail(asHttpError(503, "Service unavailable", "UNAVAILABLE")),
    );

    expect(response.status).toBe(503);
    expect(await bodyOf(response)).toEqual({
      error: "Service unavailable",
      code: "UNAVAILABLE",
    });
  });

  it("responds 500 for a plain Error failure", async () => {
    expect.hasAssertions();
    const response = await requestWithUnhandledFailure(new Error("boom"));

    expect(response.status).toBe(500);
    const body = await bodyOf(response);
    expect(body["error"]).toBe("Internal server error");
    expect(body["status"]).toBe(500);
    expect(JSON.stringify(body)).not.toContain("boom");
  });

  it("responds 500 for an HttpError-shaped value with a missing field", async () => {
    expect.hasAssertions();
    const response = await requestWithUnhandledFailure({
      status: 200,
      message: "missing retryable",
    });

    expect(response.status).toBe(500);
    const body = await bodyOf(response);
    expect(body["error"]).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("missing retryable");
  });

  it("responds 500 for an HttpError-shaped value with an extra field", async () => {
    expect.hasAssertions();
    const response = await requestWithUnhandledFailure({
      status: 200,
      message: "extra field",
      retryable: false,
      unexpected: true,
    });

    expect(response.status).toBe(500);
    const body = await bodyOf(response);
    expect(body["error"]).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toContain("extra field");
  });
});
