import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { routeOf } from '../catalog';
import { useCatalog } from '../context';
import { t } from '../i18n/t';
import { navigate, type Route } from '../router';
import { toggleTheme } from '../theme';
import { KindBadge } from './KindBadge';

interface Item {
  id: string;
  label: string;
  run: () => void;
  /** Navigation moves focus to the new screen's heading; other items give focus back. */
  navigates: boolean;
  kind?: Parameters<typeof KindBadge>[0]['kind'];
  hint?: string;
}

const MAX_ARTIFACTS = 8;

export function Palette({ onClose }: { onClose: (restoreFocus: boolean) => void }) {
  const { searcher } = useCatalog();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => input.current?.focus(), []);

  const items = useMemo<Item[]>(() => {
    const go = (route: Route) => () => navigate(route);
    const actions: Item[] = [
      { id: 'home', label: t('nav.home'), run: go({ type: 'home' }), navigates: true },
      { id: 'whats-new', label: t('nav.whatsNew'), run: go({ type: 'whats-new', plugin: null }), navigates: true },
      { id: 'start', label: t('nav.gettingStarted'), run: go({ type: 'getting-started' }), navigates: true },
      { id: 'theme', label: t('a11y.themeToggle'), run: () => void toggleTheme(), navigates: false },
    ];
    const q = query.trim().toLowerCase();
    if (q === '') return actions;
    const shownActions = actions.filter((a) => a.label.toLowerCase().includes(q));
    const found: Item[] = searcher.search(q).slice(0, MAX_ARTIFACTS).map((a) => ({
      id: `a-${a.id}`,
      label: a.name,
      run: go(routeOf(a)),
      navigates: true,
      kind: a.kind,
      hint: a.kind === 'plugin' ? undefined : a.plugin,
    }));
    return [...shownActions, ...found];
  }, [query, searcher]);

  const current = Math.min(active, Math.max(items.length - 1, 0));

  function run(item: Item | undefined) {
    if (!item) return;
    onClose(!item.navigates);
    item.run();
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      setActive((current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length);
    } else if (e.key === 'Enter' && e.target === input.current) {
      e.preventDefault();
      run(items[current]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose(true);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const order = [input.current, closeButton.current];
      const at = order.indexOf(document.activeElement as HTMLInputElement | HTMLButtonElement);
      const next = (at + (e.shiftKey ? -1 : 1) + order.length) % order.length;
      order[next]?.focus();
    }
  }

  const optionId = (i: number) => `palette-option-${i}`;
  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose(true)}>
      <div role="dialog" aria-modal="true" aria-label={t('palette.title')} className="palette" onKeyDown={onKeyDown}>
        <div className="palette-head">
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={items.length ? optionId(current) : undefined}
            aria-label={t('palette.label')}
            placeholder={t('palette.placeholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
          <button ref={closeButton} type="button" className="icon-button" aria-label={t('a11y.closePalette')} onClick={() => onClose(true)}>
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <ul id="palette-list" role="listbox" aria-label={t('palette.actions')}>
          {items.map((item, i) => (
            <li
              key={item.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === current}
              onMouseEnter={() => setActive(i)}
              onClick={() => run(item)}
            >
              {item.kind && <KindBadge kind={item.kind} />}
              <span>{item.label}</span>
              {item.hint && <span className="dim">{item.hint}</span>}
            </li>
          ))}
        </ul>
        {items.length === 0 && <p className="dim palette-empty">{t('palette.empty')}</p>}
        <p className="dim palette-hint">{t('palette.hint')}</p>
      </div>
    </div>
  );
}
