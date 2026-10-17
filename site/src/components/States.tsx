import { DataLoadError } from '../data';
import { t } from '../i18n/t';

export function ErrorState({ error, onRetry }: { error: DataLoadError; onRetry: () => void }) {
  const reason =
    error.reason === 'status' ? t('state.reasonStatus', { status: error.status ?? 0 }) : error.reason === 'network' ? t('state.reasonNetwork') : t('state.reasonParse');
  return (
    <div role="alert" className="state">
      <h2>{t('state.errorTitle')}</h2>
      <p>{t('state.errorFile', { file: error.file, reason })}</p>
      <button type="button" className="button" onClick={onRetry}>
        {t('state.retry')}
      </button>
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <p role="status" className="state">
      {label}
    </p>
  );
}

export function EmptyCatalog({ repoUrl }: { repoUrl: string }) {
  return (
    <div className="state">
      <h2>{t('empty.title')}</h2>
      <p>{t('empty.text')}</p>
      <a href={`${repoUrl}/blob/main/CONTRIBUTING.md`} rel="noopener noreferrer nofollow">
        {t('empty.contribute')}
      </a>
    </div>
  );
}
