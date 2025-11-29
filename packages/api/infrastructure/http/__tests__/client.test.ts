/** HTTP Client Tests */

import { it, expect } from "@effect/vitest";
import { Effect, Exit } from "effect";
import { HttpError, HttpParseError } from "../client";

describe("HTTP Client", () => {
  describe("HttpError", () => {
    it("creates error with correct tag", () => {
      const error = new HttpError({
        message: "Request failed",
      });

      expect(error._tag).toBe("HttpError");
      expect(error.message).toBe("Request failed");
    });

    it("creates error with optional status", () => {
      const error = new HttpError({
        message: "Not Found",
        status: 404,
      });

      expect(error.status).toBe(404);
    });

    it("creates error with optional url", () => {
      const error = new HttpError({
        message: "Server Error",
        status: 500,
        url: "https://api.example.com/data",
      });

      expect(error.url).toBe("https://api.example.com/data");
    });

    it("creates error without optional fields", () => {
      const error = new HttpError({
        message: "Network error",
      });

      expect(error.status).toBeUndefined();
      expect(error.url).toBeUndefined();
    });

    it.effect("can be used with Effect.fail", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new HttpError({
            message: "Connection refused",
          })
        );

        const result = yield* Effect.exit(program);

        expect(Exit.isFailure(result)).toBe(true);
      })
    );

    it.effect("can be caught by tag", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new HttpError({
            message: "Timeout",
            status: 408,
            url: "https://api.example.com/slow",
          })
        ).pipe(
          Effect.catchTag("HttpError", (e) =>
            Effect.succeed(`HTTP Error ${e.status}: ${e.message}`)
          )
        );

        const result = yield* program;

        expect(result).toBe("HTTP Error 408: Timeout");
      })
    );
  });

  describe("HttpParseError", () => {
    it("creates error with correct tag", () => {
      const error = new HttpParseError({
        message: "Invalid JSON",
        url: "https://api.example.com/data",
      });

      expect(error._tag).toBe("HttpParseError");
      expect(error.message).toBe("Invalid JSON");
      expect(error.url).toBe("https://api.example.com/data");
    });

    it("creates error for schema validation failure", () => {
      const error = new HttpParseError({
        message: "Schema validation failed: missing required field 'id'",
        url: "https://api.example.com/user",
      });

      expect(error.message).toContain("Schema validation failed");
    });

    it.effect("can be used with Effect.fail", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new HttpParseError({
            message: "Parse error",
            url: "https://api.example.com/data",
          })
        );

        const result = yield* Effect.exit(program);

        expect(Exit.isFailure(result)).toBe(true);
      })
    );

    it.effect("can be caught by tag", () =>
      Effect.gen(function* () {
        const program = Effect.fail(
          new HttpParseError({
            message: "Invalid response format",
            url: "https://api.example.com/data",
          })
        ).pipe(
          Effect.catchTag("HttpParseError", (e) =>
            Effect.succeed(`Parse error at ${e.url}: ${e.message}`)
          )
        );

        const result = yield* program;

        expect(result).toBe("Parse error at https://api.example.com/data: Invalid response format");
      })
    );
  });

  describe("Error discrimination", () => {
    it.effect("can discriminate between HttpError and HttpParseError", () =>
      Effect.gen(function* () {
        const handleError = (error: HttpError | HttpParseError) => {
          switch (error._tag) {
            case "HttpError":
              return `HTTP: ${error.status ?? "unknown"} - ${error.message}`;
            case "HttpParseError":
              return `Parse: ${error.message}`;
          }
        };

        const httpError = new HttpError({
          message: "Not Found",
          status: 404,
        });
        const parseError = new HttpParseError({
          message: "Invalid JSON",
          url: "https://api.example.com",
        });

        expect(handleError(httpError)).toBe("HTTP: 404 - Not Found");
        expect(handleError(parseError)).toBe("Parse: Invalid JSON");
      })
    );

    it("identifies retryable errors (5xx and 429)", () => {
      const isRetryable = (e: HttpError | HttpParseError): boolean =>
        e._tag === "HttpError" && !!e.status && (e.status >= 500 || e.status === 429);

      expect(isRetryable(new HttpError({ message: "Server Error", status: 500 }))).toBe(true);
      expect(isRetryable(new HttpError({ message: "Bad Gateway", status: 502 }))).toBe(true);
      expect(isRetryable(new HttpError({ message: "Rate Limited", status: 429 }))).toBe(true);
      expect(isRetryable(new HttpError({ message: "Not Found", status: 404 }))).toBe(false);
      expect(isRetryable(new HttpError({ message: "Bad Request", status: 400 }))).toBe(false);
      expect(
        isRetryable(new HttpParseError({ message: "Parse error", url: "https://example.com" }))
      ).toBe(false);
    });
  });
});
