import { Schema } from "effect";

const DECIMAL_AMOUNT_RE = /^(?=.*[1-9])\d+(\.\d+)?$/;
const NON_NEGATIVE_DECIMAL_RE = /^\d+(\.\d+)?$/;

export const DecimalAmountSchema: Schema.Codec<string, string> = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(DECIMAL_AMOUNT_RE, { message: "expected a positive decimal string" }),
  ),
);

// "0" is syntactically valid for price; whether it is admissible depends on
// reduceOnly and timeInForce, which only the exchange service can judge.
export const NonNegativeDecimalSchema: Schema.Codec<string, string> = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(NON_NEGATIVE_DECIMAL_RE, {
      message: "expected a non-negative decimal string",
    }),
  ),
);
