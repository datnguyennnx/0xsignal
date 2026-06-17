const INTEGER_PATTERN = /^[+-]?\d+$/;

export const parseOptionalSigFigsParam = (
  params: URLSearchParams,
  key: string,
): 2 | 3 | 4 | 5 | undefined | null => {
  const rawValue = params.get(key);
  if (!rawValue) {
    return undefined;
  }

  const value = rawValue.trim();
  if (!INTEGER_PATTERN.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed === 2 || parsed === 3 || parsed === 4 || parsed === 5) {
    return parsed;
  }

  return null;
};
