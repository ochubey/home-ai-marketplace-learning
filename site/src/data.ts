import { useCallback, useEffect, useState } from 'react';
import type { CatalogData, CatalogIndex, ReleasesFile, StatsFile } from './types';

export type FetchFn = (url: string) => Promise<Response>;
export type LoadReason = 'status' | 'network' | 'parse';

export class DataLoadError extends Error {
  constructor(
    readonly file: string,
    readonly reason: LoadReason,
    readonly status?: number,
  ) {
    super(`${file}: ${reason}${status ? ` ${status}` : ''}`);
  }
}

const defaultBase = () => import.meta.env.BASE_URL;
const defaultFetch: FetchFn = (url) => fetch(url);

async function request(file: string, fetchFn: FetchFn, base: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetchFn(`${base}data/${file}`);
  } catch {
    throw new DataLoadError(file, 'network');
  }
  if (!res.ok) throw new DataLoadError(file, 'status', res.status);
  return res;
}

export async function loadJson<T>(file: string, fetchFn: FetchFn = defaultFetch, base: string = defaultBase()): Promise<T> {
  const res = await request(file, fetchFn, base);
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    throw new DataLoadError(file, 'parse');
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new DataLoadError(file, 'parse');
  }
  return parsed as T;
}

export async function loadCatalog(fetchFn: FetchFn = defaultFetch, base: string = defaultBase()): Promise<CatalogData> {
  const [index, releases, stats] = await Promise.all([
    loadJson<CatalogIndex>('index.json', fetchFn, base),
    loadJson<ReleasesFile>('releases.json', fetchFn, base),
    loadJson<StatsFile>('stats.json', fetchFn, base),
  ]);
  if (!Array.isArray(index.plugins) || !Array.isArray(index.artifacts)) throw new DataLoadError('index.json', 'parse');
  if (!Array.isArray(releases.releases)) throw new DataLoadError('releases.json', 'parse');
  return { index, releases, stats };
}

export const bodyFile = (id: string) => `bodies/${id}.md`;

export async function loadBody(id: string, fetchFn: FetchFn = defaultFetch, base: string = defaultBase()): Promise<string> {
  const file = bodyFile(id);
  const res = await request(file, fetchFn, base);
  try {
    return await res.text();
  } catch {
    throw new DataLoadError(file, 'parse');
  }
}

export type AsyncState<T> = { status: 'loading' } | { status: 'error'; error: DataLoadError } | { status: 'ready'; data: T };

/** Runs `load` whenever `key` changes; `retry` runs it again. */
export function useAsync<T>(load: () => Promise<T>, key: string): { state: AsyncState<T>; retry: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    load().then(
      (data) => active && setState({ status: 'ready', data }),
      (error: unknown) => active && setState({ status: 'error', error: error instanceof DataLoadError ? error : new DataLoadError(key, 'network') }),
    );
    return () => {
      active = false;
    };
    // `load` is recreated on every render; `key` and `attempt` identify the request.
  }, [key, attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
