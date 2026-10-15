import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListSocialAccounts,
  listSocialAccountsQueryKey,
} from '@/api/generated/hooks/integrationsHooks/useListSocialAccounts';
import { useCreateSocialConnectUrl } from '@/api/generated/hooks/integrationsHooks/useCreateSocialConnectUrl';
import { useDisconnectSocialAccount } from '@/api/generated/hooks/integrationsHooks/useDisconnectSocialAccount';
import { apiErrorMessage } from '@/lib/api-errors';
import { PLATFORMS, platformLabel, PLATFORMS_WITH_CREDENTIALS } from '@/components/actions/PlatformNames';
import { PlatformIcon } from '@/components/actions/PlatformIcon';
import { BlueskyConnectDialog } from '@/components/integrations/BlueskyConnectDialog';
import { Help } from '@/components/Help';
import { SectionLoading } from '@/components/SectionState';
import { Badge } from '@/components/ui/badge';
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
 * As redes sociais do cliente.
 *
 * Um botão por rede, e não um botão só: o provider dá uma URL de consentimento por
 * plataforma, e isso é melhor do que uma página intermediária — o cliente vê o que
 * vai autorizar antes de clicar, e vai direto para a rede.
 *
 * A lista é lida ao vivo e nunca guardada: ela muda do outro lado, e um cache
 * nosso mostraria uma conta que o cliente já desconectou.
 */
export function SocialSourceCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const accounts = useListSocialAccounts();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listSocialAccountsQueryKey() });

  const onError = (err: unknown) => setError(apiErrorMessage(err, t('pages.integrations.social.connectFailed')));

  const connect = useCreateSocialConnectUrl({
    mutation: {
      onMutate: () => setError(null),
      onSuccess: (data, variables) => {
        /**
         * O Bluesky não tem consentimento para abrir: a conta já foi criada do lado
         * do provider quando as credenciais chegaram, e a `url` que ele devolve é
         * uma página de aterrissagem dele. Abrir uma aba ali mandaria o cliente ao
         * site do fornecedor sem motivo — o que ele precisa é ver a conta na lista.
         */
        if (PLATFORMS_WITH_CREDENTIALS.includes(String(variables.data.platform))) {
          void invalidate();
          return;
        }

        // Nova aba, e não redirect: o cliente volta para a AUREA no estado em que
        // estava, e a autorização acontece no site da rede.
        window.open(data.url, '_blank', 'noopener,noreferrer');
      },
      onError,
    },
  });

  const disconnect = useDisconnectSocialAccount({
    mutation: { onMutate: () => setError(null), onSuccess: () => invalidate(), onError },
  });

  const connected = accounts.data?.accounts ?? [];
  const byPlatform = new Map(connected.map((account) => [String(account.platform), account]));

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm font-medium">
          {t('pages.integrations.social.title')}
          <Help title={t('pages.integrations.social.helpTitle')}>{t('pages.integrations.social.help')}</Help>
        </p>

        {accounts.isLoading && <SectionLoading />}

        {accounts.data && connected.length === 0 && (
          <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
            {t('pages.integrations.social.empty')}
          </p>
        )}

        <ul className="space-y-3">
          {PLATFORMS.map((platform) => {
            const account = byPlatform.get(platform);
            const needsAttention = account !== undefined && !account.connected;

            return (
              <li key={platform} className="flex flex-wrap items-center gap-3">
                {/* A foto do perfil quando a conta está conectada; o logo da rede
                    quando não está. Antes era um círculo cinza vazio, que não
                    dizia de qual rede era a linha nem que havia rede ali. */}
                {account?.pictureUrl ? (
                  <img src={account.pictureUrl} alt="" className="size-8 rounded-full object-cover" />
                ) : (
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <PlatformIcon platform={platform} className="size-4 text-muted-foreground" />
                  </span>
                )}
                <span className="text-sm font-medium">{platformLabel(platform)}</span>
                {account?.username && <span className="text-xs text-muted-foreground">{account.username}</span>}

                {/* O aviso antes da falha: o token caiu, e publicar nesta rede
                    falharia. A criação de ação também a recusa. */}
                {needsAttention && (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    {t('pages.integrations.social.reconnect')}
                  </Badge>
                )}

                {/* Conectar e reconectar são o mesmo ato: autorizar a rede outra vez.
                    No Bluesky não há autorização para abrir — há credencial para
                    digitar, então o botão abre um formulário em vez de uma aba. */}
                {(account === undefined || needsAttention) &&
                  (PLATFORMS_WITH_CREDENTIALS.includes(platform) ? (
                    <BlueskyConnectDialog
                      pending={connect.isPending}
                      label={
                        needsAttention
                          ? t('pages.integrations.social.reconnect')
                          : t('pages.integrations.social.connectOne')
                      }
                      onSubmit={(credentials) =>
                        connect.mutate({ data: { platform: platform as never, ...credentials } })
                      }
                    />
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={connect.isPending}
                      onClick={() => connect.mutate({ data: { platform: platform as never } })}
                    >
                      {needsAttention
                        ? t('pages.integrations.social.reconnect')
                        : t('pages.integrations.social.connectOne')}
                    </Button>
                  ))}

                {account !== undefined && account.connected && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" disabled={disconnect.isPending}>
                        {t('pages.integrations.social.disconnect')}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('pages.integrations.social.disconnectTitle', { network: platformLabel(platform) })}
                        </AlertDialogTitle>
                        {/* Nomeia o que se perde: a autorização some do lado do
                            fornecedor, e reconectar exige autorizar de novo. */}
                        <AlertDialogDescription>
                          {t('pages.integrations.social.disconnectBody')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => disconnect.mutate({ accountId: account.id })}
                          className="bg-destructive text-white hover:bg-destructive/90"
                        >
                          {t('pages.integrations.social.disconnect')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </li>
            );
          })}
        </ul>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
