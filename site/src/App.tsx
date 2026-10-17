import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Palette } from './components/Palette';
import { SearchBox } from './components/SearchBox';
import { ErrorState, LoadingState } from './components/States';
import { formatDate } from './catalog';
import { AnnounceContext, CatalogContext, FetchContext, NavigatedContext } from './context';
import { loadCatalog, useAsync, type FetchFn } from './data';
import { t } from './i18n/t';
import { createSearcher } from './search';
import { screenKey, useRoute } from './router';
import { initTheme, toggleTheme, useTheme } from './theme';
import { ArtifactDetail } from './screens/ArtifactDetail';
import { GettingStarted } from './screens/GettingStarted';
import { Home } from './screens/Home';
import { NotFound } from './screens/NotFound';
import { PluginDetail } from './screens/PluginDetail';
import { Search } from './screens/Search';
import { WhatsNew } from './screens/WhatsNew';
import type { CatalogData } from './types';

const FALLBACK_REPO = 'https://github.com/ochubey/home-ai-marketplace-learning';

const isTextField = (el: Element | null) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable);

export function App({ fetchFn, base }: { fetchFn?: FetchFn; base?: string }) {
  const route = useRoute();
  const theme = useTheme();
  const { state, retry } = useAsync(() => loadCatalog(fetchFn, base), 'catalog');
  const [announcement, setAnnouncement] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const returnFocus = useRef<Element | null>(null);
  const main = useRef<HTMLElement>(null);

  // Whether the user has moved to another screen (the first screen does not steal focus).
  const navigated = useRef(false);
  const firstKey = useRef(screenKey(route));
  if (screenKey(route) !== firstKey.current) navigated.current = true;

  useEffect(() => {
    initTheme();
  }, []);

  const ready: CatalogData | null = state.status === 'ready' ? state.data : null;
  const catalog = useMemo(
    () =>
      ready && {
        data: ready,
        searcher: createSearcher(ready.index.artifacts),
        ref: ready.index.source.commit ?? 'main',
        repoUrl: ready.index.source.repoUrl,
      },
    [ready],
  );

  const openPalette = useCallback(() => {
    returnFocus.current = document.activeElement;
    setPaletteOpen(true);
  }, []);
  const closePalette = useCallback((restore: boolean) => {
    setPaletteOpen(false);
    if (restore) {
      const target = returnFocus.current as HTMLElement | null;
      setTimeout(() => target?.isConnected && target.focus(), 0);
    }
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (paletteOpen) closePalette(true);
        else if (catalog) openPalette();
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !paletteOpen && !isTextField(document.activeElement)) {
        const box = document.querySelector<HTMLInputElement>('input[data-search-input]');
        if (box) {
          e.preventDefault();
          box.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [paletteOpen, catalog, openPalette, closePalette]);

  function skip(e: MouseEvent) {
    e.preventDefault();
    main.current?.focus();
  }

  let body;
  if (state.status === 'loading') body = <LoadingState label={t('state.loading')} />;
  else if (state.status === 'error') body = <ErrorState error={state.error} onRetry={retry} />;
  else {
    switch (route.type) {
      case 'home':
        body = <Home route={route} />;
        break;
      case 'search':
        body = <Search route={route} />;
        break;
      case 'plugin':
        body = <PluginDetail name={route.plugin} />;
        break;
      case 'artifact':
        body = <ArtifactDetail plugin={route.plugin} kind={route.kind} name={route.name} />;
        break;
      case 'whats-new':
        body = <WhatsNew plugin={route.plugin} />;
        break;
      case 'getting-started':
        body = <GettingStarted />;
        break;
      default:
        body = <NotFound path={route.path} />;
    }
  }

  const source = ready?.index.source;
  const repoUrl = source?.repoUrl ?? FALLBACK_REPO;
  const unknown = t('footer.unknown');
  const content = (
    <>
      <a className="skip-link" href="#main-content" onClick={skip}>
        {t('a11y.skipToContent')}
      </a>
      <header className="site-header">
        <a className="brand" href="#/">
          {t('site.name')}
        </a>
        <nav aria-label={t('a11y.mainNav')}>
          <a href="#/search">{t('nav.catalog')}</a>
          <a href="#/whats-new">{t('nav.whatsNew')}</a>
          <a href="#/getting-started">{t('nav.gettingStarted')}</a>
        </nav>
        {route.type !== 'home' && <SearchBox route={route} live />}
        <button type="button" className="icon-button" aria-label={t('a11y.openPalette')} onClick={() => catalog && openPalette()}>
          <span aria-hidden="true">&#8984;K</span>
        </button>
        <button type="button" className="icon-button" data-theme-toggle aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')} onClick={() => void toggleTheme()}>
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
        </button>
      </header>
      <main id="main-content" ref={main} tabIndex={-1} aria-busy={state.status === 'loading'}>
        {body}
      </main>
      <footer className="site-footer">
        <p>
          {t('footer.built', { commit: source?.commit ?? unknown, date: formatDate(source?.commitDate ?? null) ?? unknown })}
        </p>
        <a href={repoUrl} rel="noopener noreferrer nofollow">
          {t('footer.repository')}
        </a>
      </footer>
      <div className="sr-only" role="status" aria-live="polite" data-live-region>
        {announcement}
      </div>
      {paletteOpen && catalog && <Palette onClose={closePalette} />}
    </>
  );

  return (
    <FetchContext.Provider value={{ fetchFn, base }}>
      <NavigatedContext.Provider value={navigated}>
        <AnnounceContext.Provider value={setAnnouncement}>
          {catalog ? <CatalogContext.Provider value={catalog}>{content}</CatalogContext.Provider> : content}
        </AnnounceContext.Provider>
      </NavigatedContext.Provider>
    </FetchContext.Provider>
  );
}
