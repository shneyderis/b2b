const PREFIX = 'winery_cache:';

type Entry<T> = { v: T; exp: number };

function now() {
  return Date.now();
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry<T>;
    if (e.exp < now()) {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    return e.v;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  try {
    const e: Entry<T> = { v: value, exp: now() + ttlMs };
    sessionStorage.setItem(PREFIX + key, JSON.stringify(e));
  } catch {
    // storage full / disabled — ignore
  }
}

export function cacheInvalidate(key: string) {
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
