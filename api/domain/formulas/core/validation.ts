import { Effect } from "effect";
import { ValidationError, InsufficientDataError, InvalidDataError } from "./errors";

export const validatePriceArray = (
  prices: ReadonlyArray<number>,
  minLength: number,
  formula: string
): Effect.Effect<ReadonlyArray<number>, InsufficientDataError | InvalidDataError> =>
  Effect.gen(function* () {
    if (prices.length < minLength) {
      return yield* Effect.fail(
        new InsufficientDataError({
          formula,
          required: minLength,
          actual: prices.length,
        })
      );
    }

    const issues: string[] = [];
    prices.forEach((price, index) => {
      if (typeof price !== "number" || !isFinite(price)) {
        issues.push(`Invalid price at index ${index}: ${price}`);
      }
      if (price < 0) {
        issues.push(`Negative price at index ${index}: ${price}`);
      }
    });

    if (issues.length > 0) {
      return yield* Effect.fail(
        new InvalidDataError({
          formula,
          issues,
        })
      );
    }

    return prices;
  });

export const validateNumber = (
  value: number,
  name: string,
  formula: string
): Effect.Effect<number, ValidationError> =>
  Effect.gen(function* () {
    const errors: string[] = [];

    if (typeof value !== "number" || !isFinite(value)) {
      errors.push(`${name} must be a finite number, got: ${value}`);
    }

    if (errors.length > 0) {
      return yield* Effect.fail(
        new ValidationError({
          formula,
          errors,
        })
      );
    }

    return value;
  });

export const validateRange = (
  value: number,
  min: number,
  max: number,
  name: string,
  formula: string
): Effect.Effect<number, ValidationError> =>
  Effect.gen(function* () {
    yield* validateNumber(value, name, formula);

    if (value < min || value > max) {
      return yield* Effect.fail(
        new ValidationError({
          formula,
          errors: [`${name} must be between ${min} and ${max}, got: ${value}`],
        })
      );
    }

    return value;
  });
