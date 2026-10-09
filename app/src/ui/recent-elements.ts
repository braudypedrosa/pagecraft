export const RECENT_ELEMENTS_KEY = 'pagecraft.recent-elements.v1';
const LIMIT = 6;
type StorageAccess = () => Pick<Storage, 'getItem' | 'setItem'>;

/** Personal palette history is a browser preference, not part of the site or undo history. */
export function createRecentElementsStore(keys: readonly string[], storage: StorageAccess = () => window.localStorage) {
  const allowed = new Set(keys);
  let fallback: string[] = [];
  let unavailable = false;
  const listeners = new Set<(keys: string[]) => void>();
  const clean = (value: unknown): string[] => Array.isArray(value)
    ? [...new Set(value.filter((key): key is string => typeof key === 'string' && allowed.has(key)))].slice(0, LIMIT)
    : [];
  const read = () => {
    try {
      if (!unavailable) fallback = clean(JSON.parse(storage().getItem(RECENT_ELEMENTS_KEY) || '[]'));
    } catch { /* A blocked browser store must not break element insertion. */ }
    return [...fallback];
  };
  const record = (key: string) => {
    if (!allowed.has(key)) return;
    fallback = clean([key, ...read()]);
    try { storage().setItem(RECENT_ELEMENTS_KEY, JSON.stringify(fallback)); }
    catch { unavailable = true; /* Keep working for this session when persistence is unavailable. */ }
    listeners.forEach(listener => listener([...fallback]));
  };
  return {
    read,
    record,
    subscribe(listener: (keys: string[]) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
}
