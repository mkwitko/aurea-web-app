import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListIntegrations,
  listIntegrationsQueryKey,
} from '@/api/generated/hooks/integrationsHooks/useListIntegrations';
import { useRemoveIntegration } from '@/api/generated/hooks/integrationsHooks/useRemoveIntegration';
import { apiErrorMessage } from '@/lib/api-errors';
import { Help } from '@/components/Help';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { GoogleConnectButton } from './GoogleConnectButton';
import { PropertyPicker } from './PropertyPicker';
import { ServiceAccountForm } from './ServiceAccountForm';

const PROVIDER = 'GA4';

/** O vocabulário fechado que o callback emite. Qualquer outro vira `unknown`. */
const REASONS = ['access_denied', 'no_refresh_token', 'exchange_failed', 'missing_code'] as const;

function readReturn(): { status: 'connected' | 'error'; reason: string } | null {
  const params = new URLSearchParams(window.location.search);
  const google = params.get('google');
  if (google !== 'connected' && google !== 'error') return null;
  const raw = params.get('reason') ?? '';
  return {
    status: google,
    reason: (REASONS as readonly string[]).includes(raw) ? raw : 'unknown',
  };
}

/**
 * A fonte de dados do workspace: conectar, escolher a property, ver o estado.
 *
 * Três estados, e o do meio é o que a Parte anterior não tinha: entre autorizar
 * no Google e escolher a property, a fonte existe e não mede nada. Dizer isso
 * na tela é o que evita o fundador esperar por um número que nunca vem.
 *
 * O `AlertDialogAction asChild` do plano original brigava com o fechamento do
 * Radix ao envolver um botão que dispara uma mutação (o clique fecha o diálogo
 * antes da resposta chegar, e o segundo clique vindo do teste passa a mirar em
 * nada). O `GoogleConnectButton` de confirmação mora no corpo do diálogo, e o
 * footer só fecha — o comportamento que importa ("nada é pedido ao servidor
 * antes da confirmação") não depende de onde o botão mora.
 */
export function Ga4SourceCard() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  // Sem setter: o banner é lido do URL na montagem e não muda depois. Um setter
  // que ninguém chama sugere um banner dispensável que não existe.
  const [banner] = useState(readReturn);

  // Lido uma vez e apagado: um F5 não pode ressuscitar a mensagem de uma
  // conexão que aconteceu há dez minutos.
  useEffect(() => {
    if (!banner) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('google');
    url.searchParams.delete('reason');
    window.history.replaceState({}, '', url.toString());
  }, [banner]);

  const integrations = useListIntegrations();
  const connected = integrations.data?.integrations.find((row) => row.provider === PROVIDER) ?? null;
  const hasProperty = Boolean(connected?.externalId);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: listIntegrationsQueryKey() });

  const disconnect = useRemoveIntegration({
    mutation: {
      onMutate: () => setError(null),
      onSuccess: async () => {
        setPicking(false);
        await invalidate();
      },
      onError: (err) => setError(apiErrorMessage(err, t('pages.integrations.connectFailed'))),
    },
  });

  const formatDate = (value: Date | string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm font-medium">
          Google Analytics 4
          <Help title={t('pages.integrations.helpTitle')}>{t('pages.integrations.help')}</Help>
        </p>

        {banner?.status === 'connected' && (
          <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            {t('pages.integrations.google.connectedBanner')}
          </p>
        )}
        {banner?.status === 'error' && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p>{t('pages.integrations.google.errorBanner')}</p>
            <p className="text-muted-foreground">{t(`pages.integrations.google.reason.${banner.reason}`)}</p>
          </div>
        )}

        {integrations.isLoading && <SectionLoading />}
        {(integrations.isError || (!integrations.isLoading && !integrations.data)) && (
          <SectionLoadError refetch={[integrations.refetch]} />
        )}

        {/* Estado 1: nada conectado. */}
        {integrations.data && !connected && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('pages.integrations.empty')}</p>
            <GoogleConnectButton label={t('pages.integrations.google.connect')} onError={setError} />
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm">{t('pages.integrations.google.advanced')}</summary>
              <p className="mt-2 text-xs text-muted-foreground">{t('pages.integrations.google.advancedHint')}</p>
              <div className="mt-3">
                <ServiceAccountForm onConnected={invalidate} onError={setError} />
              </div>
            </details>
          </div>
        )}

        {/* Estado 2 e 3: conectado. */}
        {integrations.data && connected && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="muted">{t(`pages.integrations.status.${connected.status}`)}</Badge>
              {connected.lastCheckedAt && (
                <span className="text-xs text-muted-foreground">
                  {t('pages.integrations.lastChecked')}: {formatDate(connected.lastCheckedAt)}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{t('pages.integrations.account')}</p>
              <p className="text-sm text-muted-foreground">{connected.accountLabel}</p>
            </div>

            {hasProperty && !picking && (
              <>
                <div>
                  <p className="text-sm font-medium">{t('pages.integrations.property')}</p>
                  <p className="font-mono text-sm text-muted-foreground">{connected.externalId}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPicking(true)}>
                  {t('pages.integrations.picker.change')}
                </Button>
              </>
            )}

            {/* Conectado sem property: o estado que não existia antes, dito na
                tela em vez de descoberto na hora de medir. */}
            {!hasProperty && (
              <p className="text-sm text-muted-foreground">{t('pages.integrations.picker.noneChosen')}</p>
            )}

            {(picking || !hasProperty) && (
              <PropertyPicker
                current={connected.externalId ?? null}
                onSelected={() => setPicking(false)}
                {...(hasProperty ? { onCancel: () => setPicking(false) } : {})}
              />
            )}

            {connected.lastError && <p className="text-sm text-destructive">{connected.lastError}</p>}

            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <GoogleConnectButton
                label={t('pages.integrations.google.connect')}
                onError={setError}
                // Substituir é destrutivo: a confirmação vem antes de qualquer
                // requisição.
                onBeforeStart={() => {
                  setConfirmReplace(true);
                  return false;
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate({ params: { provider: PROVIDER } })}
              >
                {t('pages.integrations.disconnect')}
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('pages.integrations.replace.title')}</AlertDialogTitle>
              <AlertDialogDescription>{t('pages.integrations.replace.body')}</AlertDialogDescription>
            </AlertDialogHeader>
            <GoogleConnectButton
              label={t('pages.integrations.replace.confirm')}
              onError={setError}
              onBeforeStart={() => {
                setConfirmReplace(false);
                return true;
              }}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>{t('pages.integrations.replace.cancel')}</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
