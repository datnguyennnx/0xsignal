/**
 * LRU-limited Map that evicts the least-recently-used entry when at capacity.
 * The `get` method bumps the entry to MRU position; `set` evicts LRU when full.
 *
 * Implements the full Map interface so it can be used as a drop-in replacement
 * for `new Map()` in existing cache code.
 */
export function createLruCache<V>(maxSize: number): Map<string, V> {
  const cache = new Map<string, V>();

  const lru: Map<string, V> = {
    get(key: string): V | undefined {
      const entry = cache.get(key);
      if (entry !== undefined) {
        // Move to end (most recently used)
        cache.delete(key);
        cache.set(key, entry);
      }
      return entry;
    },

    set(key: string, value: V): Map<string, V> {
      if (cache.has(key)) {
        cache.delete(key);
      } else if (cache.size >= maxSize) {
        // Delete least recently used (first entry)
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) cache.delete(firstKey);
      }
      cache.set(key, value);
      return lru;
    },

    has(key: string): boolean {
      return cache.has(key);
    },

    delete(key: string): boolean {
      return cache.delete(key);
    },

    clear(): void {
      cache.clear();
    },

    get size(): number {
      return cache.size;
    },

    forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void, thisArg?: any): void {
      cache.forEach((v, k) => callbackfn.call(thisArg, v, k, lru));
    },

    entries() {
      return cache.entries();
    },

    keys() {
      return cache.keys();
    },

    values() {
      return cache.values();
    },

    [Symbol.iterator]() {
      return cache.entries();
    },

    get [Symbol.toStringTag](): string {
      return "LRUCache";
    },
  };

  return lru;
}
