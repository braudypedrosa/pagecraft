import { describe, expect, test } from 'vitest';
import { createRecentElementsStore, RECENT_ELEMENTS_KEY } from '../app/src/ui/recent-elements';

const keys = ['heading', 'text', 'image', 'button', 'columns', 'nav', 'spacer'];
function memoryStorage(initial: string | null = null) {
  let value = initial;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
}

describe('recent element preferences', () => {
  test('persists six distinct types with reuse moved to the front', () => {
    const storage = memoryStorage();
    const store = createRecentElementsStore(keys, () => storage);
    keys.forEach(store.record);
    store.record('heading');
    expect(store.read()).toEqual(['heading', 'spacer', 'nav', 'columns', 'button', 'image']);
    expect(createRecentElementsStore(keys, () => storage).read()).toEqual(store.read());
  });

  test('rejects unsupported and malformed stored values without fabricating history', () => {
    for (const value of ['{', '{}', 'null', '"heading"']) {
      expect(createRecentElementsStore(keys, () => memoryStorage(value)).read()).toEqual([]);
    }
    const store = createRecentElementsStore(keys, () => memoryStorage('["nav", null, "unknown", "nav", 5, "heading"]'));
    expect(store.read()).toEqual(['nav', 'heading']);
    store.record('unknown');
    expect(store.read()).toEqual(['nav', 'heading']);
  });

  test('keeps session history when storage access or writing fails', () => {
    const fail = () => { throw new Error('Browser storage blocked'); };
    for (const access of [fail, () => ({ getItem: () => null, setItem: fail })]) {
      const store = createRecentElementsStore(keys, access);
      store.record('heading');
      store.record('image');
      expect(store.read()).toEqual(['image', 'heading']);
    }
  });

  test('notifies mounted panels and stops after unsubscription', () => {
    const storage = memoryStorage();
    const store = createRecentElementsStore(keys, () => storage);
    const updates: string[][] = [];
    const unsubscribe = store.subscribe(value => updates.push(value));
    store.record('heading');
    unsubscribe();
    store.record('image');
    expect(updates).toEqual([['heading']]);
    expect(JSON.parse(storage.getItem()!)).toEqual(['image', 'heading']);
    expect(RECENT_ELEMENTS_KEY).toBe('pagecraft.recent-elements.v1');
  });
});
