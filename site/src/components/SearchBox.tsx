import { useEffect, useState, type FormEvent } from 'react';
import { t } from '../i18n/t';
import { navigate, type Route } from '../router';

/** Header variant searches while typing; the home variant searches on submit. */
export function SearchBox({ route, live }: { route: Route; live: boolean }) {
  const routeQuery = route.type === 'search' ? route.q : null;
  const [value, setValue] = useState(routeQuery ?? '');
  useEffect(() => {
    if (routeQuery !== null) setValue(routeQuery);
  }, [routeQuery]);

  function go(q: string) {
    const base = route.type === 'search' ? route : { kinds: [], plugins: [] };
    navigate({ type: 'search', q, kinds: base.kinds, plugins: base.plugins }, { replace: route.type === 'search' });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    go(value);
  }

  return (
    <form role="search" className="searchbox" onSubmit={onSubmit}>
      <input
        type="search"
        data-search-input
        aria-label={t('search.label')}
        placeholder={t('search.placeholder')}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (live) go(e.target.value);
        }}
      />
      {!live && (
        <button type="submit" className="button">
          {t('search.submit')}
        </button>
      )}
    </form>
  );
}
