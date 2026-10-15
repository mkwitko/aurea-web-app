import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useGetAction, getActionQueryKey } from '@/api/generated/hooks/actionsHooks/useGetAction';
import { useExecuteAction } from '@/api/generated/hooks/actionsHooks/useExecuteAction';
import { useCancelAction } from '@/api/generated/hooks/actionsHooks/useCancelAction';
import { apiErrorMessage } from '@/lib/api-errors';
import { PageHeader } from '@/components/PageHeader';
import { Help } from '@/components/Help';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { ActionStatusBadge } from '@/components/actions/ActionStatusBadge';
import { ActionApprovalPanel } from '@/components/actions/ActionApprovalPanel';
import { ActionTargetList } from '@/components/actions/ActionTargetList';
import { ActionTargetResolvePanel } from '@/components/actions/ActionTargetResolvePanel';
import { isVideoUrl } from '@/components/actions/MediaPicker';
import { platformLabel, PLATFORM_CONSEQUENCE } from '@/components/actions/PlatformNames';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

/**
 * Os estados de onde uma execução pode partir, iguais aos de `EXECUTABLE_FROM` no
 * backend.
 *
 * `DELIVERY_UNKNOWN` **não** está aqui: a Post for Me não tem endpoint de retry,
 * então retentar de um alvo incerto é um segundo envio às cegas, que duplica post
 * público. O backend recusa a transição, e oferecer o botão seria prometer o que a
 * API nega. A saída é o `ActionTargetResolvePanel`, alvo por alvo.
 */
const EXECUTABLE = ['APPROVED', 'PARTIALLY_EXECUTED', 'FAILED'];

/** Cancelar não existe onde algo pode ter saído para o mundo. */
const CANCELLABLE = ['PROPOSED', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_EXECUTED', 'FAILED'];

/**
 * Retentar é post novo, e atinge só o alvo que ainda não publicou
 * (`PENDING`/`FAILED`): o publicado fica de fora porque nada desfaz um post, e o
 * incerto porque ninguém sabe se publicou.
 */
const RETRY_STATES = ['PARTIALLY_EXECUTED', 'FAILED'];

export function ActionDetailPage() {
  const { t } = useTranslation();
  /** "YouTube · público": a consequência junto do nome, na tela onde se desiste. */
  const destinationLabel = (platform: string): string => {
    const consequence = PLATFORM_CONSEQUENCE[platform];
    return consequence ? `${platformLabel(platform)} · ${t(consequence)}` : platformLabel(platform);
  };
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const action = useGetAction(id ?? '', {
    query: {
      enabled: Boolean(id),
      // Enquanto está em voo, a tela pesquisa: quem publica é o worker, e a
      // resposta de `execute` é 202, não o desfecho.
      refetchInterval: (query) => (query.state.data?.action.status === 'EXECUTING' ? 5000 : false),
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: getActionQueryKey(id ?? '') });

  const onError = (err: unknown) => setError(apiErrorMessage(err, t('pages.actions.detail.actionFailed')));
  const execute = useExecuteAction({
    mutation: { onMutate: () => setError(null), onSuccess: () => refresh(), onError },
  });
  const cancel = useCancelAction({
    mutation: { onMutate: () => setError(null), onSuccess: () => refresh(), onError },
  });

  if (action.isLoading) return <SectionLoading />;
  if (action.isError || !action.data) return <SectionLoadError refetch={[action.refetch]} />;

  const current = action.data.action;
  const targets = action.data.targets;
  // O retry atinge exatamente estes, e a confirmação diz isso.
  const pendingTargets = targets.filter((target) => target.status === 'PENDING' || target.status === 'FAILED');
  const unknownTargets = targets.filter((target) => target.status === 'DELIVERY_UNKNOWN');
  const isRetry = RETRY_STATES.includes(current.status);
  const willReceive = isRetry ? pendingTargets : targets;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={t('app.nav.actions')}
        title={current.name}
        help={<Help title={t('pages.actions.helpTitle')}>{t('pages.actions.help')}</Help>}
      />

      <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <ActionStatusBadge status={current.status} />
          </div>

          <div>
            <p className="text-sm font-medium">{t('pages.actions.detail.content')}</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{current.payload.content}</p>
          </div>

          {/* As imagens aparecem aqui porque é aqui que se aprova: aprovar um post
              sem ver a imagem que sai com ele é aprovar metade dele. São as URLs
              gravadas no payload, as mesmas que o worker manda ao provider. */}
          {current.payload.media && current.payload.media.length > 0 && (
            <div>
              <p className="text-sm font-medium">{t('pages.actions.detail.media')}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {current.payload.media.map((url) => (
                  <li key={url}>
                    {/* Vídeo com controles: quem aprova precisa poder assistir ao
                        que vai ao ar, não ver um retângulo. */}
                    {isVideoUrl(url) ? (
                      <video
                        src={url}
                        controls
                        preload="metadata"
                        className="h-32 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <img src={url} alt="" className="size-20 rounded-md border border-border object-cover" />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t pt-3">
            <p className="text-sm font-medium">{t('pages.actions.detail.targets')}</p>
            <div className="mt-2">
              <ActionTargetList targets={targets} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Um painel por alvo incerto: a decisão é sobre uma rede, não sobre o post. */}
      {unknownTargets.map((target) => (
        <ActionTargetResolvePanel key={target.id} actionId={current.id} target={target} onChanged={refresh} />
      ))}

      <Card>
        <CardContent className="space-y-3 p-5">
          <ActionApprovalPanel action={current} approvals={action.data.approvals} onChanged={refresh} />

          {/* A aprovação já foi o portão, mas quem clica aqui pode não ser quem
              aprovou, e um post público não volta atrás pela AUREA — o diálogo
              nomeia as redes para que ninguém publique no lugar errado. */}
          {EXECUTABLE.includes(current.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" disabled={execute.isPending}>
                  {isRetry ? t('pages.actions.detail.retry') : t('pages.actions.detail.execute')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t('pages.actions.detail.confirmExecute.title', {
                      networks: willReceive.map((target) => destinationLabel(target.platform)).join(', '),
                    })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {/* Numa retentativa o risco é outro: só as redes que não
                        publicaram são tentadas, e é isso que o provider faz. */}
                    {isRetry
                      ? t('pages.actions.detail.confirmExecute.retryBody')
                      : t('pages.actions.detail.confirmExecute.body')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => execute.mutate({ id: current.id })}>
                    {t('pages.actions.detail.confirmExecute.confirm')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {current.status === 'EXECUTING' && (
            <p className="text-sm text-muted-foreground">{t('pages.actions.detail.executing')}</p>
          )}

          {CANCELLABLE.includes(current.status) && (
            <Button
              size="sm"
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ id: current.id })}
            >
              {t('pages.actions.detail.cancel')}
            </Button>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
