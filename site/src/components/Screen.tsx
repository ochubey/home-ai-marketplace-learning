import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { NavigatedContext } from '../context';
import { t } from '../i18n/t';

/** One screen: sets the document title and moves focus to the single h1 after a route change. */
export function Screen({ title, heading, children }: { title: string; heading?: string; children: ReactNode }) {
  const h1 = useRef<HTMLHeadingElement>(null);
  const navigated = useContext(NavigatedContext);
  useEffect(() => {
    document.title = `${title} - ${t('site.name')}`;
    if (navigated.current) h1.current?.focus();
  }, [title, navigated]);
  return (
    <>
      <h1 ref={h1} tabIndex={-1}>
        {heading ?? title}
      </h1>
      {children}
    </>
  );
}
