import { t } from '../i18n/t';
import type { Kind } from '../types';

export function KindBadge({ kind }: { kind: Kind }) {
  return (
    <span className="badge" data-kind={kind}>
      {t(`kind.${kind}`)}
    </span>
  );
}
