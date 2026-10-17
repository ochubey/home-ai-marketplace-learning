import { useEffect, useRef, useState } from 'react';
import { copyText, selectContents } from '../clipboard';
import { t } from '../i18n/t';

const VISIBLE_MS = 3000;

export function InstallBlock({ plugin }: { plugin: string }) {
  const commands = `${t('install.add')}\n${t('install.plugin', { plugin })}`;
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const pre = useRef<HTMLPreElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function onCopy() {
    clearTimeout(timer.current);
    if (await copyText(commands)) {
      setStatus('copied');
      timer.current = setTimeout(() => setStatus('idle'), VISIBLE_MS);
    } else {
      setStatus('failed');
      if (pre.current) selectContents(pre.current);
    }
  }

  return (
    <section className="install" aria-labelledby={`install-${plugin}`}>
      <h2 id={`install-${plugin}`}>{t('install.heading')}</h2>
      <pre ref={pre}>{commands}</pre>
      <button type="button" className="button" onClick={onCopy}>
        {t('install.copy')}
      </button>
      <p role="status" aria-live="polite" className="copy-status">
        {status === 'copied' ? t('install.copied') : status === 'failed' ? t('install.copyFailed') : ''}
      </p>
    </section>
  );
}
