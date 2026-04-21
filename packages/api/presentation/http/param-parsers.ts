export const parseOptionalSigFigsParam = (
  params: URLSearchParams,
  key: string
): 2 | 3 | 4 | 5 | undefined | null => {
  const value = params.get(key);
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed === 2 || parsed === 3 || parsed === 4 || parsed === 5) {
    return parsed;
  }

  return null;
};
