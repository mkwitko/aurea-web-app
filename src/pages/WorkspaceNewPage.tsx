import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AuthShell } from '@/components/AuthShell';
import { Button } from '@/components/ui/button';
import { useCreateWorkspace } from '@/api/generated/hooks/workspacesHooks/useCreateWorkspace';
import { listWorkspacesQueryKey } from '@/api/generated/hooks/workspacesHooks/useListWorkspaces';
import { meQueryKey } from '@/api/generated/hooks/authHooks/useMe';
import type { MeQueryResponse } from '@/api/generated/types/Me';
import { useAuth } from '@/lib/auth';
import { useWorkspace } from '@/lib/workspace';
import { apiErrorMessage } from '@/lib/api-errors';

/**
 * O primeiro workspace da conta. Página cheia, fora do AppLayout: é a única
 * coisa que a conta pode fazer neste estado, e uma superfície fechável deixaria
 * o usuário parado num app vazio.
 *
 * A navegação espera o /auth/me: é a membership nova que levanta o WorkspaceGate,
 * e sair daqui antes dela chegar voltaria para cá na hora.
 */
export function WorkspaceNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasWorkspace, logout } = useAuth();
  const { setWorkspaceId } = useWorkspace();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  // O POST já passou: guarda o id do workspace criado (não só um booleano) —
  // o retry de `confirmSession` precisa dele para terminar a troca de
  // workspace sem reenviar o formulário. A partir daqui o formulário some da
  // tela: reenviar criaria um segundo workspace com o mesmo nome.
  const [created, setCreated] = useState<{ id: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  /**
   * Reconfirma a sessão ANTES de trocar o workspace ativo. `setWorkspaceId`
   * chama `queryClient.clear()`, que remove a query de `/auth/me` do cache —
   * um refetch feito depois disso não encontra mais nada para atualizar e
   * resolve na hora sem buscar nada. Por isso o refetch roda primeiro, com a
   * query ainda viva, e só troca o workspace ativo e navega quando a sessão
   * relida realmente reporta a nova membership. Se não reportar (refetch
   * falhou, ou a sessão ainda não viu a membership nova), o estado
   * "created" continua na tela e o retry chama isto de novo — nunca reenvia
   * o POST.
   */
  async function confirmSession(workspaceId: string) {
    setConfirming(true);
    setError(null);
    try {
      await queryClient.refetchQueries({ queryKey: meQueryKey() });
      const me = queryClient.getQueryData<MeQueryResponse>(meQueryKey());
      const sessionHasWorkspace = me?.memberships.some((m) => m.workspaceId !== null) ?? false;
      if (!sessionHasWorkspace) {
        setError(t('app.workspace.firstStalled'));
        return;
      }
      setWorkspaceId(workspaceId);
      navigate('/app', { replace: true });
    } catch {
      setError(t('app.workspace.firstStalled'));
    } finally {
      setConfirming(false);
    }
  }

  const create = useCreateWorkspace({
    mutation: {
      onMutate: () => setError(null),
      onSuccess: async (workspace) => {
        setCreated({ id: workspace.id });
        await queryClient.invalidateQueries({ queryKey: listWorkspacesQueryKey() });
        await confirmSession(workspace.id);
      },
      // As palavras do backend: a mensagem do teto de plano cita a contagem e o
      // limite, coisa que copy genérica não faz.
      onError: (err) => setError(apiErrorMessage(err, t('app.workspace.createFailed'))),
    },
  });

  // Guarda reversa: uma conta que já tem workspace não tem o que fazer aqui —
  // sem isto, a página cria silenciosamente um enésimo workspace. `created`
  // vem antes: no meio do próprio fluxo de criação, `hasWorkspace` pode virar
  // `true` antes do `navigate('/app')` da confirmSession ser processado, e
  // isto não pode competir com aquela navegação.
  if (!created && hasWorkspace) return <Navigate to="/app" replace />;

  return (
    <AuthShell
      eyebrow={t('app.workspace.firstEyebrow')}
      title={t('app.workspace.firstTitle')}
      subtitle={t('app.workspace.firstSubtitle')}
    >
      {created ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('app.workspace.firstCreated')}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            type="button"
            className="w-full"
            disabled={confirming}
            onClick={() => created && void confirmSession(created.id)}
          >
            {t('app.workspace.firstRetry')}
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ data: { name: name.trim() } });
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="workspace-name" className="text-sm font-medium">
              {t('app.workspace.nameLabel')}
            </label>
            <input
              id="workspace-name"
              value={name}
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">{t('app.workspace.firstHint')}</p>
          </div>
          {error && (
            <div className="space-y-1">
              <p className="text-sm text-destructive">{error}</p>
              {/* Spec's "no membership at all" row: that 403 comes from
                  `resolveOrgTenant`, and it means the account has nothing to
                  create a workspace with — the only way out is another
                  account, not a retry of this form. */}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs text-muted-foreground"
                onClick={() => void logout()}
              >
                {t('app.signout')}
              </Button>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={create.isPending || name.trim() === ''}>
            {create.isPending ? t('common.saving') : t('app.workspace.firstSubmit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
