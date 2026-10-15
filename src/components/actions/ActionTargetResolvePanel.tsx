import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useResolveActionTarget } from '@/api/generated/hooks/actionsHooks/useResolveActionTarget';
import { apiErrorMessage } from '@/lib/api-errors';
import { platformLabel } from './PlatformNames';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextField } from '@/components/form/TextField';

type Target = {
  id: string;
  platform: string;
  lastError: string | null;
  updatedAt: string | Date;
};

/**
 * A saída da entrega incerta, e a cópia mais delicada do produto.
 *
 * O aviso vem **antes** dos botões, e nomeia a rede e o horário: o fundador tem de
 * olhar a rede dele antes de decidir. Um botão neutro de "tentar de novo" aqui
 * produziria um segundo post público (spec §8.3).
 */
export function ActionTargetResolvePanel({
  actionId,
  target,
  onChanged,
}: {
  actionId: string;
  target: Target;
  onChanged: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [externalId, setExternalId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resolve = useResolveActionTarget({
    mutation: {
      onMutate: () => setError(null),
      onSuccess: () => onChanged(),
      onError: (err) => setError(apiErrorMessage(err, t('pages.actions.detail.actionFailed'))),
    },
  });

  const attemptedAt = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(target.updatedAt));

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <p className="text-sm font-medium">{t('pages.actions.delivery.title')}</p>
        <p className="text-sm">{t('pages.actions.delivery.checkFirst')}</p>
        <p className="text-xs text-muted-foreground">
          {platformLabel(target.platform)} · {t('pages.actions.delivery.attemptedAt')} {attemptedAt}
        </p>
        {target.lastError && <p className="text-xs text-muted-foreground">{target.lastError}</p>}

        <TextField
          htmlFor={`delivery-external-id-${target.id}`}
          label={t('pages.actions.delivery.externalIdLabel')}
          value={externalId}
          onChange={setExternalId}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={resolve.isPending}
            onClick={() =>
              resolve.mutate({
                id: actionId,
                targetId: target.id,
                // Sem id, a chave não vai: um externalId vazio seria proveniência
                // inventada de um post real.
                data: {
                  outcome: 'PUBLISHED',
                  ...(externalId.trim() ? { externalId: externalId.trim() } : {}),
                },
              })
            }
          >
            {t('pages.actions.delivery.published')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={resolve.isPending}
            onClick={() =>
              resolve.mutate({ id: actionId, targetId: target.id, data: { outcome: 'NOT_PUBLISHED' } })
            }
          >
            {t('pages.actions.delivery.notPublished')}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
