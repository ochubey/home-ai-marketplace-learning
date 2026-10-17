import { useSyncExternalStore } from 'react';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'catalog-theme';
let current: Theme = 'dark';
const listeners = new Set<() => void>();

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function writeStored(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage is blocked: the choice lasts for this session only.
  }
}

export function applyTheme(theme: Theme): void {
  current = theme;
  document.documentElement.dataset.theme = theme;
  listeners.forEach((l) => l());
}

/** Dark is the default; a stored choice wins. Call once before the first render. */
export function initTheme(): Theme {
  applyTheme(readStored() ?? 'dark');
  return current;
}

export function getTheme(): Theme {
  return current;
}

export function toggleTheme(): Theme {
  const next: Theme = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  writeStored(next);
  return next;
}

export function resetThemeForTests(): void {
  current = 'dark';
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    getTheme,
    () => 'dark' as Theme,
  );
}
