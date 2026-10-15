import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

/**
 * Segura o app inteiro até a conta ter um workspace.
 *
 * Vai por `hasWorkspace` (memberships de /auth/me) e não pela lista de
 * workspaces: a lista é uma rota de domínio, e sem workspace ela responde 403 —
 * o gate teria que ler um erro para descobrir o estado normal de uma conta
 * recém-criada.
 *
 * Roda dentro do ProtectedRoute, que já espera a sessão resolver antes de
 * montar isto: `ProtectedRoute` só renderiza os filhos quando `status` é
 * `authenticated`, então o ramo `loading` abaixo não é alcançável através
 * dele hoje — é defesa contra este componente vir a ser montado por outro
 * caminho no futuro (`hasWorkspace` é `false` tanto para "sem workspace"
 * quanto para "ainda carregando", e sem este checar `status` primeiro um
 * `<Navigate>` disparado durante o carregamento desmontaria o componente
 * antes da sessão terminar de resolver).
 */
export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { hasWorkspace, status } = useAuth();
  if (status === 'loading') return null;
  if (!hasWorkspace) return <Navigate to="/app/workspaces/new" replace />;
  return <>{children}</>;
}
