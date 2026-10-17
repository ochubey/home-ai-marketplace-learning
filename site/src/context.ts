import { createContext, useContext, type MutableRefObject } from 'react';
import type { Searcher } from './search';
import type { CatalogData } from './types';

export interface CatalogCtx {
  data: CatalogData;
  searcher: Searcher;
  /** Commit (short SHA) or `main`. */
  ref: string;
  repoUrl: string;
}

export const CatalogContext = createContext<CatalogCtx | null>(null);

export function useCatalog(): CatalogCtx {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('CatalogContext is missing');
  return ctx;
}

export const AnnounceContext = createContext<(message: string) => void>(() => undefined);
export const useAnnounce = () => useContext(AnnounceContext);

/** `current` becomes true once the user has moved to another screen. */
export const NavigatedContext = createContext<MutableRefObject<boolean>>({ current: false });

export interface FetchSettings {
  fetchFn?: (url: string) => Promise<Response>;
  base?: string;
}
export const FetchContext = createContext<FetchSettings>({});
