import { Screen } from '../components/Screen';
import { useCatalog } from '../context';
import { t, type MessageKey } from '../i18n/t';

const STEPS: { title: MessageKey; command: MessageKey; note?: MessageKey }[] = [
  { title: 'start.addTitle', command: 'start.add' },
  { title: 'start.installTitle', command: 'start.install' },
  { title: 'start.refreshTitle', command: 'start.refresh' },
  { title: 'start.updateTitle', command: 'start.update' },
  { title: 'start.reloadTitle', command: 'start.reload', note: 'start.reloadNote' },
  { title: 'start.listTitle', command: 'start.list' },
];

export function GettingStarted() {
  const { repoUrl } = useCatalog();
  return (
    <Screen title={t('start.title')} heading={t('start.heading')}>
      <p>{t('start.intro')}</p>
      {STEPS.map((s) => (
        <section key={s.command}>
          <h2>{t(s.title)}</h2>
          {s.note && <p className="dim">{t(s.note)}</p>}
          <pre>{t(s.command)}</pre>
        </section>
      ))}
      <p>
        {t('start.more')}{' '}
        <a href={`${repoUrl}/blob/main/README.md`} rel="noopener noreferrer nofollow">
          {t('start.readme')}
        </a>
      </p>
    </Screen>
  );
}
