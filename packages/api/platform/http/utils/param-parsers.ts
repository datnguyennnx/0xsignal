import { Effect, Result, Schema, SchemaGetter, SchemaIssue } from "effect";
import { asHttpError, type HttpError } from "../error-response";

export const TrimmedString = Schema.Trim;

const IntegerFromQuery = Schema.FiniteFromString.pipe(Schema.check(Schema.isInt()));

export const PositiveIntegerFromQuery = IntegerFromQuery.pipe(
  Schema.check(Schema.isGreaterThan(0)),
);

const normalizeQueryToken = (token: string): string => token.trim().toLowerCase();

export const splitQueryList = (raw: string): string[] =>
  raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token !== "");

const membership = <const Values extends ReadonlyArray<string>>(values: Values) => {
  const isMember = (token: string): token is Values[number] => values.some((v) => v === token);
  return isMember;
};

const expectedValues = (values: ReadonlyArray<string>): string =>
  `expected one of: ${values.join(", ")}`;

const decodeMember = <const Values extends ReadonlyArray<string>>(
  values: Values,
  token: string,
): Effect.Effect<Values[number], SchemaIssue.Issue> => {
  const normalized = normalizeQueryToken(token);
  const member = values.find((value) => value === normalized);
  return member === undefined
    ? Effect.fail(new SchemaIssue.InvalidValue({ message: expectedValues(values) }, token))
    : Effect.succeed(member);
};

export const NormalizedEnum = <const Values extends ReadonlyArray<string>>(values: Values) => {
  const isMember = membership(values);
  return Schema.String.pipe(
    Schema.check(
      Schema.makeFilter(
        (raw: string) => isMember(normalizeQueryToken(raw)) || expectedValues(values),
      ),
    ),
    Schema.decodeTo(Schema.Literals(values), {
      decode: SchemaGetter.transformEffect((raw: string) => decodeMember(values, raw)),
      encode: SchemaGetter.transform((value: Values[number]) => value),
    }),
  );
};

export const NormalizedEnumList = <const Values extends ReadonlyArray<string>>(values: Values) => {
  const isMember = membership(values);
  return Schema.String.pipe(
    Schema.check(
      Schema.makeFilter(
        (raw: string) =>
          splitQueryList(raw).every((token) => isMember(normalizeQueryToken(token))) ||
          expectedValues(values),
      ),
    ),
    Schema.decodeTo(Schema.Array(Schema.Literals(values)).pipe(Schema.mutable), {
      decode: SchemaGetter.transformEffect((raw: string) =>
        Effect.all(splitQueryList(raw).map((token) => decodeMember(values, token))),
      ),
      encode: SchemaGetter.transform((items: Values[number][]) => items.join(",")),
    }),
  );
};

const toQueryRecord = (searchParams: URLSearchParams): Record<string, string> => {
  const record: Record<string, string> = {};
  for (const [key, value] of searchParams) {
    // Every route treats a blank parameter as if the client had omitted it.
    if (value.trim() !== "") record[key] = value;
  }
  return record;
};

const formatDecodeFailure = (error: Schema.SchemaError): string =>
  error.message.replaceAll(/\n\s+/g, " ");

export const parseQuery = <S extends Schema.ConstraintDecoder<unknown>>(
  searchParams: URLSearchParams,
  schema: S,
): Effect.Effect<S["Type"], HttpError> =>
  Result.match(Schema.decodeUnknownResult(schema)(toQueryRecord(searchParams)), {
    onFailure: (error) => Effect.fail(asHttpError(400, formatDecodeFailure(error))),
    onSuccess: (value) => Effect.succeed(value),
  });
