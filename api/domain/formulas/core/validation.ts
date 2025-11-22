// ============================================================================
// INPUT VALIDATION UTILITIES - FUNCTIONAL APPROACH
// ============================================================================
// Pure validation functions that return Either<Error, Valid>
// Ensures 100% calculation accuracy through comprehensive checks
// ============================================================================

import { Effect, Either } from "effect";
import { ValidationError, InsufficientDataError, InvalidDataError } from './errors';

/**
 * Validates that an array of numbers is valid
 * Returns Either with error or validated data
 */
export const validateNumberArray = (
  data: ReadonlyArray<number>,
  fieldName: string,
  formulaName: string
): Either.Either<ReadonlyArray<number>, InvalidDataError> => {
  const errors: string[] = [];

  if (!data || data.length === 0) {
    errors.push(`${fieldName} array is required and cannot be empty`);
  } else {
    const invalidIndices = data
      .map((val, idx) => ({ val, idx }))
      .filter(({ val }) => !Number.isFinite(val))
      .map(({ idx }) => idx);

    if (invalidIndices.length > 0) {
      errors.push(
        `${fieldName} contains invalid numbers at indices: ${invalidIndices.join(', ')}`
      );
    }
  }

  return errors.length > 0
    ? Either.left(new InvalidDataError({ formula: formulaName, issues: errors }))
    : Either.right(data);
};

/**
 * Validates that prices are positive
 */
export const validatePositivePrices = (
  prices: ReadonlyArray<number>,
  formulaName: string
): Either.Either<ReadonlyArray<number>, InvalidDataError> => {
  const invalidIndices = prices
    .map((price, idx) => ({ price, idx }))
    .filter(({ price }) => price <= 0)
    .map(({ idx }) => idx);

  return invalidIndices.length > 0
    ? Either.left(
        new InvalidDataError({
          formula: formulaName,
          issues: [`Prices must be positive at indices: ${invalidIndices.join(', ')}`]
        })
      )
    : Either.right(prices);
};

/**
 * Validates that volumes are non-negative
 */
export const validateNonNegativeVolumes = (
  volumes: ReadonlyArray<number>,
  formulaName: string
): Either.Either<ReadonlyArray<number>, InvalidDataError> => {
  const invalidIndices = volumes
    .map((vol, idx) => ({ vol, idx }))
    .filter(({ vol }) => vol < 0)
    .map(({ idx }) => idx);

  return invalidIndices.length > 0
    ? Either.left(
        new InvalidDataError({
          formula: formulaName,
          issues: [`Volumes must be non-negative at indices: ${invalidIndices.join(', ')}`]
        })
      )
    : Either.right(volumes);
};

/**
 * Validates that sufficient data is available
 */
export const validateDataLength = (
  data: ReadonlyArray<number>,
  required: number,
  formulaName: string
): Either.Either<ReadonlyArray<number>, InsufficientDataError> => {
  return data.length < required
    ? Either.left(
        new InsufficientDataError({
          formula: formulaName,
          required,
          actual: data.length
        })
      )
    : Either.right(data);
};

/**
 * Validates that two arrays have the same length
 */
export const validateArrayLengthMatch = (
  array1: ReadonlyArray<number>,
  array2: ReadonlyArray<number>,
  name1: string,
  name2: string,
  formulaName: string
): Either.Either<
  { array1: ReadonlyArray<number>; array2: ReadonlyArray<number> },
  ValidationError
> => {
  return array1.length !== array2.length
    ? Either.left(
        new ValidationError({
          formula: formulaName,
          errors: [
            `${name1} and ${name2} must have the same length (${array1.length} vs ${array2.length})`
          ]
        })
      )
    : Either.right({ array1, array2 });
};

/**
 * Validates OHLC data consistency
 */
export const validateOHLC = (
  opens: ReadonlyArray<number>,
  highs: ReadonlyArray<number>,
  lows: ReadonlyArray<number>,
  closes: ReadonlyArray<number>,
  formulaName: string
): Either.Either<
  {
    opens: ReadonlyArray<number>;
    highs: ReadonlyArray<number>;
    lows: ReadonlyArray<number>;
    closes: ReadonlyArray<number>;
  },
  InvalidDataError
> => {
  const errors: string[] = [];
  const length = opens.length;

  if (highs.length !== length || lows.length !== length || closes.length !== length) {
    errors.push('OHLC arrays must all have the same length');
  }

  for (let i = 0; i < length; i++) {
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];

    if (l > Math.min(o, c)) {
      errors.push(`Period ${i}: low (${l}) must be <= min(open, close)`);
    }
    if (h < Math.max(o, c)) {
      errors.push(`Period ${i}: high (${h}) must be >= max(open, close)`);
    }
    if (l > h) {
      errors.push(`Period ${i}: low (${l}) must be <= high (${h})`);
    }
  }

  return errors.length > 0
    ? Either.left(new InvalidDataError({ formula: formulaName, issues: errors }))
    : Either.right({ opens, highs, lows, closes });
};

/**
 * Validates that a period parameter is valid
 */
export const validatePeriod = (
  period: number,
  minPeriod: number,
  formulaName: string
): Either.Either<number, ValidationError> => {
  return !Number.isInteger(period) || period < minPeriod
    ? Either.left(
        new ValidationError({
          formula: formulaName,
          errors: [`Period must be an integer >= ${minPeriod}, got ${period}`]
        })
      )
    : Either.right(period);
};
