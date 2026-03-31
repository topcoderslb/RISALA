import { getDocs, Query, DocumentData, QuerySnapshot } from 'firebase/firestore';

interface CacheEntry {
  data: QuerySnapshot<DocumentData>;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<QuerySnapshot<DocumentData>>>();

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Cached wrapper around getDocs.
 * - Deduplicates concurrent identical requests
 * - Returns cached results within TTL window
 * - key: a unique string identifying this query
 * - ttl: cache duration in ms (default 5 min)
 */
export async function cachedGetDocs(
  q: Query<DocumentData>,
  key: string,
  ttl: number = DEFAULT_TTL
): Promise<QuerySnapshot<DocumentData>> {
  // Return cached if fresh
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  // Deduplicate concurrent requests for the same key
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = getDocs(q).then((snap) => {
    cache.set(key, { data: snap, timestamp: Date.now() });
    inFlight.delete(key);
    return snap;
  }).catch((err) => {
    inFlight.delete(key);
    throw err;
  });

  inFlight.set(key, promise);
  return promise;
}

/** Invalidate a specific cache key */
export function invalidateCache(key: string) {
  cache.delete(key);
}

/** Invalidate all cache keys that start with a prefix */
export function invalidateCachePrefix(prefix: string) {
  const toDelete: string[] = [];
  cache.forEach((_, k) => { if (k.startsWith(prefix)) toDelete.push(k); });
  toDelete.forEach(k => cache.delete(k));
}

/** Clear entire cache */
export function clearCache() {
  cache.clear();
}
