import { useContext } from 'react';
import { FetchContext, useCatalog } from '../context';
import { loadBody, useAsync } from '../data';
import { t } from '../i18n/t';
import { MarkdownView } from '../markdown';
import { ErrorState, LoadingState } from './States';

/** Fetches a body file and renders it as sanitized Markdown. */
export function BodyView({ id, baseDir }: { id: string; baseDir: string }) {
  const { ref, repoUrl } = useCatalog();
  const { fetchFn, base } = useContext(FetchContext);
  const { state, retry } = useAsync(() => loadBody(id, fetchFn, base), id);
  if (state.status === 'loading') return <LoadingState label={t('state.loadingBody')} />;
  if (state.status === 'error') return <ErrorState error={state.error} onRetry={retry} />;
  return <MarkdownView source={state.data} ctx={{ baseDir, repoUrl, ref }} />;
}
