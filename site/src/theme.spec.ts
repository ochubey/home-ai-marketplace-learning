import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, getTheme, initTheme, resetThemeForTests, toggleTheme } from './theme';

function stubStorage(impl: Partial<Storage> | 'throws') {
  const store = new Map<string, string>();
  const base: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, v),
  };
  if (impl === 'throws') {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
  } else {
    vi.stubGlobal('localStorage', { ...base, ...impl });
  }
  return store;
}

beforeEach(() => {
  resetThemeForTests();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => vi.unstubAllGlobals());

describe('theme with storage', () => {
  it('starts dark when nothing is stored', () => {
    stubStorage({});
    expect(initTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('toggles and remembers the choice', () => {
    const store = stubStorage({});
    initTheme();
    expect(toggleTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(store.get('catalog-theme')).toBe('light');
    resetThemeForTests();
    expect(initTheme()).toBe('light');
    expect(toggleTheme()).toBe('dark');
    expect(store.get('catalog-theme')).toBe('dark');
  });

  it('ignores a stored value it does not know', () => {
    const store = stubStorage({});
    store.set('catalog-theme', 'purple');
    expect(initTheme()).toBe('dark');
  });
});

describe('theme without storage', () => {
  it('still starts dark and toggles for the session', () => {
    stubStorage('throws');
    expect(initTheme()).toBe('dark');
    expect(toggleTheme()).toBe('light');
    expect(getTheme()).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(toggleTheme()).toBe('dark');
  });

  it('applyTheme sets the attribute', () => {
    stubStorage('throws');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
