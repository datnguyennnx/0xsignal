export type JsonSchema = {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  enum?: readonly unknown[];
  items?: JsonSchema;
  additionalProperties?: boolean;
  minimum?: number;
  maximum?: number;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateSchemaValue = (schema: JsonSchema, value: unknown, path = "input"): string[] => {
  const errors: string[] = [];

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of: ${schema.enum.join(", ")}`);
    return errors;
  }

  if (!schema.type) {
    return errors;
  }

  if (schema.type === "object") {
    if (!isPlainObject(value)) {
      errors.push(`${path} must be an object`);
      return errors;
    }

    for (const key of schema.required ?? []) {
      if (!(key in value)) {
        errors.push(`${path}.${key} is required`);
      }
    }

    if (schema.properties) {
      for (const [key, childSchema] of Object.entries(schema.properties)) {
        if (!(key in value)) {
          continue;
        }
        errors.push(...validateSchemaValue(childSchema, value[key], `${path}.${key}`));
      }

      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!(key in schema.properties)) {
            errors.push(`${path}.${key} is not allowed`);
          }
        }
      }
    }

    return errors;
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path} must be an array`);
      return errors;
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i++) {
        errors.push(...validateSchemaValue(schema.items, value[i], `${path}[${i}]`));
      }
    }
    return errors;
  }

  if (schema.type === "string" && typeof value !== "string") {
    errors.push(`${path} must be a string`);
  }

  if (schema.type === "number" && typeof value !== "number") {
    errors.push(`${path} must be a number`);
  }

  if (schema.type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      errors.push(`${path} must be an integer`);
    }
  }

  if ((schema.type === "number" || schema.type === "integer") && typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) {
      errors.push(`${path} must be >= ${schema.minimum}`);
    }
    if (typeof schema.maximum === "number" && value > schema.maximum) {
      errors.push(`${path} must be <= ${schema.maximum}`);
    }
  }

  if (schema.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${path} must be a boolean`);
  }

  return errors;
};

export const validateToolArguments = (
  schema: JsonSchema,
  args: unknown
): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } => {
  const value = isPlainObject(args) ? args : {};
  const errors = validateSchemaValue(schema, value);
  if (errors.length > 0) {
    return { ok: false, message: errors.join("; ") };
  }
  return { ok: true, value };
};

export const formatToolErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }

  return String(error);
};
