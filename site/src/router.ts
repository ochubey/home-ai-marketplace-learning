import { useMemo, useSyncExternalStore } from 'react';
import { KINDS, type Kind } from './types';

export type Route =
  | { type: 'home' }
  | { type: 'search'; q: string; kinds: Kind[]; plugins: string[] }
  | { type: 'plugin'; plugin: string }
  | { type: 'artifact'; plugin: string; kind: Exclude<Kind, 'plugin'>; name: string }
  | { type: 'whats-new'; plugin: string | null }
  | { type: 'getting-started' }
  | { type: 'not-found'; path: string };

const SEGMENT_RE = /^[a-z0-9][a-z0-9-]*$/;
const isKind = (v: string): v is Kind => (KINDS as readonly string[]).includes(v);

function decode(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}


function listParam(params: URLSearchParams, key: string): string[] {
  const raw = params.get(key);
  return raw ? raw.split(',').filter(Boolean) : [];
}

export function parseHash(hash: string): Route {
  let rest = hash.startsWith('#') ? hash.slice(1) : hash;
  if (rest === '' || rest === '/') return { type: 'home' };
  const queryAt = rest.indexOf('?');
  const queryText = queryAt >= 0 ? rest.slice(queryAt + 1) : '';
  if (queryAt >= 0) rest = rest.slice(0, queryAt);
  const notFound: Route = { type: 'not-found', path: rest.startsWith('/') ? rest : `/${rest}` };
  if (!rest.startsWith('/')) return notFound;
  const rawParts = rest.slice(1).split('/');
  const parts: string[] = [];
  for (const p of rawParts) {
    const d = decode(p);
    if (d === null) return notFound;
    parts.push(d);
  }
  const params = new URLSearchParams(queryText);
  const [first, a, b, c] = parts;
  if (parts.length === 1 && first === 'search') {
    return {
      type: 'search',
      q: params.get('q') ?? '',
      kinds: listParam(params, 'kind').filter(isKind),
      plugins: listParam(params, 'plugin').filter((p) => SEGMENT_RE.test(p)),
    };
  }
  if (first === 'plugins' && a !== undefined && SEGMENT_RE.test(a)) {
    if (parts.length === 2) return { type: 'plugin', plugin: a };
    if (parts.length === 4 && b !== undefined && c !== undefined && isKind(b) && b !== 'plugin' && SEGMENT_RE.test(c)) {
      return { type: 'artifact', plugin: a, kind: b, name: c };
    }
    return notFound;
  }
  if (parts.length === 1 && first === 'whats-new') {
    const plugin = params.get('plugin');
    return { type: 'whats-new', plugin: plugin !== null && SEGMENT_RE.test(plugin) ? plugin : null };
  }
  if (parts.length === 1 && first === 'getting-started') return { type: 'getting-started' };
  return notFound;
}

export function serializeRoute(route: Route): string {
  switch (route.type) {
    case 'home':
      return '#/';
    case 'search': {
      const params: string[] = [];
      if (route.q) params.push(`q=${encodeURIComponent(route.q)}`);
      if (route.kinds.length) params.push(`kind=${route.kinds.join(',')}`);
      if (route.plugins.length) params.push(`plugin=${route.plugins.join(',')}`);
      return params.length ? `#/search?${params.join('&')}` : '#/search';
    }
    case 'plugin':
      return `#/plugins/${route.plugin}`;
    case 'artifact':
      return `#/plugins/${route.plugin}/${route.kind}/${route.name}`;
    case 'whats-new':
      return route.plugin ? `#/whats-new?plugin=${route.plugin}` : '#/whats-new';
    case 'getting-started':
      return '#/getting-started';
    case 'not-found':
      return `#${route.path}`;
  }
}

/** Identity of a screen without its query, so typing in search does not count as navigating. */
export function screenKey(route: Route): string {
  switch (route.type) {
    case 'plugin':
      return `plugin:${route.plugin}`;
    case 'artifact':
      return `artifact:${route.plugin}/${route.kind}/${route.name}`;
    case 'whats-new':
      return `whats-new:${route.plugin ?? ''}`;
    case 'not-found':
      return `not-found:${route.path}`;
    default:
      return route.type;
  }
}

const CHANGE_EVENT = 'catalog:routechange';

export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const hash = serializeRoute(route);
  if (options.replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } else if (location.hash !== hash) {
    location.hash = hash;
  }
}

function subscribe(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener('hashchange', listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

const getHash = () => location.hash;

/** The current hash as a string; components parse it with `parseHash` (kept a string for stable snapshots). */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '');
  return useMemo(() => parseHash(hash), [hash]);
}
