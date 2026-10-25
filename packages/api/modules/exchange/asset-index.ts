/** Maps the exchange universe (ordered coin names) to settlement asset indices. */
export const buildCoinToAsset = (meta: {
  readonly universe: ReadonlyArray<{ readonly name: string }>;
}): Map<string, number> => new Map(meta.universe.map((u, i) => [u.name, i]));
