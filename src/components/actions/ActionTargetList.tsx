import { useTranslation } from 'react-i18next';
import { platformLabel } from './PlatformNames';
import { PlatformIcon } from './PlatformIcon';
import { ActionTargetStatusBadge } from './ActionStatusBadge';

type Target = {
  id: string;
  platform: string;
  status: string;
  externalId: string | null;
  postUrl: string | null;
  lastError: string | null;
};

/**
 * Uma linha por rede, com o desfecho de cada uma.
 *
 * A `postUrl` vem do provider e é mostrada como link: é o que torna "publicado"
 * verificável pelo fundador em um clique, em vez de uma palavra nossa. Quando ela
 * não vem, o id cru aparece — e nada é construído por nós (spec §8.2).
 */
export function ActionTargetList({ targets }: { targets: Target[] }) {
  const { t } = useTranslation();

  return (
    <ul className="space-y-2">
      {targets.map((target) => (
        <li key={target.id} className="flex flex-wrap items-center gap-3 border-t pt-2 first:border-t-0 first:pt-0">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <PlatformIcon platform={target.platform} />
            {platformLabel(target.platform)}
          </span>
          <ActionTargetStatusBadge status={target.status} />

          {target.postUrl && (
            <a
              href={target.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline hover:no-underline"
            >
              {t('pages.actions.detail.seePost')}
            </a>
          )}

          {!target.postUrl && target.externalId && (
            <span className="font-mono text-xs text-muted-foreground">{target.externalId}</span>
          )}

          {/* A mensagem da fonte, literal: "Missing subreddit" diz o que fazer,
              "falha ao publicar" não diz nada. */}
          {target.lastError && target.status !== 'DELIVERY_UNKNOWN' && (
            <span className="text-xs text-destructive">{target.lastError}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
