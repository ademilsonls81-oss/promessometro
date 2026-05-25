interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 300_000;

export function get<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DEFAULT_TTL) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function set<T>(key: string, data: T, ttlMs?: number): void {
  store.set(key, { data, timestamp: Date.now() });
}

export function invalidate(pattern?: string): void {
  if (pattern) {
    for (const key of store.keys()) {
      if (key.includes(pattern)) store.delete(key);
    }
  } else {
    store.clear();
  }
}
