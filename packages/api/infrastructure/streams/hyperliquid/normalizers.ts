const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const unwrapPayload = (value: unknown): unknown => {
  let current = value;

  while (isRecord(current)) {
    if (current.data !== undefined) {
      current = current.data;
      continue;
    }
    if (current.payload !== undefined) {
      current = current.payload;
      continue;
    }
    break;
  }

  return current;
};

const extractOrderbookLevels = (value: unknown): unknown[] | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (Array.isArray(value.levels)) {
    return value.levels;
  }

  if ("l2Book" in value) {
    return extractOrderbookLevels(value.l2Book);
  }

  if ("book" in value) {
    return extractOrderbookLevels(value.book);
  }

  if ("orderbook" in value) {
    return extractOrderbookLevels(value.orderbook);
  }

  return null;
};

export const normalizeCandleData = (event: unknown): unknown => unwrapPayload(event);

export const normalizeL2BookData = (event: unknown): { levels: unknown[] } => {
  const payload = unwrapPayload(event);
  return {
    levels: extractOrderbookLevels(payload) ?? [],
  };
};

export const normalizeTradesData = (event: unknown): unknown => unwrapPayload(event);
export const normalizeAllMidsData = (event: unknown): unknown => unwrapPayload(event);
