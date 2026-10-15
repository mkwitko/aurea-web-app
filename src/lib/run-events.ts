import { useEffect } from 'react';
import { queryClient } from '@/api/query-client';
import { AGENT_RUNS, CREDITS } from '@/api/modules';
import { API_BASE } from './api-base';
import { tokenStore } from './api';
import { useWorkspace } from './workspace';

// Module-level, not component state: `AppLayout` remounts on every
// navigation (each route in `App.tsx` wraps its own `<Protected><AppLayout>`
// tree), so a connection kept on a component would be torn down and reopened
// on every click through the nav. One `EventSource` for the whole app avoids
// that churn, and `EventSource` itself already handles reconnecting after a
// transient drop — nothing here hand-rolls that.
let source: EventSource | null = null;
// The workspace `source` is currently open against. Compared against the
// caller's current workspace on every mount so a plain nav remount (same
// workspace) is a no-op, but a picker switch (different workspace) tears
// down the old channel instead of leaving it subscribed to the wrong one.
let sourceWorkspaceId: string | null = null;
// Espera entre uma falha do stream e a reabertura, e o timer que a controla.
// Sem o timer, uma rajada de erros abriria vários EventSource de uma vez.
const RETRY_MS = 3_000;
let reopening: ReturnType<typeof setTimeout> | null = null;

function isAgentRunsQueryKey(key: unknown): boolean {
  return (
    typeof key === 'object' &&
    key !== null &&
    'url' in key &&
    typeof (key as { url: unknown }).url === 'string' &&
    (key as { url: string }).url.startsWith(AGENT_RUNS.ENDPOINT)
  );
}

function disconnect(): void {
  source?.close();
  source = null;
}

function connect(workspaceId: string | null): void {
  if (source && sourceWorkspaceId === workspaceId) return;

  // Switching workspace (or the very first connect) — never keep a stream
  // subscribed to a channel that no longer matches the caller's selection.
  disconnect();

  // No token yet (signed out) — nothing to open. The next mount of whatever
  // calls `useAgentRunEvents` (post-login) will try again.
  const token = tokenStore.access;
  if (!token) return;

  sourceWorkspaceId = workspaceId;
  const params = new URLSearchParams({ token });
  // Absent until a workspace has been explicitly picked — `EventSource`
  // cannot send the `x-workspace-id` header every other request uses, so the
  // backend accepts this same id as a query param instead (validated there
  // with the identical membership lookup). With nothing picked yet, the
  // backend's own fallback (oldest membership) applies, same as any other
  // request with no header.
  if (workspaceId) params.set('workspaceId', workspaceId);

  source = new EventSource(`${API_BASE}/events/agent-runs?${params.toString()}`);
  source.onmessage = () => {
    // The event only says "something finished" — it carries no filters the
    // cache could apply cheaper than an invalidation, so every agent-runs
    // query (the list and whichever detail is mounted) is marked stale.
    void queryClient.invalidateQueries({ predicate: (query) => isAgentRunsQueryKey(query.queryKey[0]) });
    // E o saldo junto: um run que falha é estornado pelo backend
    // (`onRunFailed`), e nenhuma mutação do cliente participa disso — sem esta
    // linha o chip de crédito continuava mostrando o valor debitado até a
    // próxima recarga da página. A criação do run (o débito) é coberta pelo
    // MutationCache em `api/query-client.ts`.
    void queryClient.invalidateQueries({ queryKey: CREDITS.queryKeyRoot });
    void queryClient.invalidateQueries({ queryKey: CREDITS.ledgerQueryKeyRoot });
  };
  // O token viaja na url e é capturado uma vez, no open. Quando ele expira o
  // browser reconecta sozinho — sempre com a MESMA url, ou seja, com o token
  // morto — e fica nisso indefinidamente. Foi o que aconteceu: horas de
  // requisições ao stream carregando um token expirado havia muito tempo.
  //
  // Então fechamos na primeira falha e reabrimos com o token que estiver
  // válido AGORA. Se o access token já venceu, `tokenStore.access` ainda o
  // devolve; quem renova é o client HTTP, no próximo request. Por isso a
  // reabertura espera um instante em vez de tentar renovar aqui: duplicar o
  // refresh em dois lugares é como duas rotinas de logout divergem.
  //
  // Sem token nenhum, `connect()` não abre nada e o polling cobre — a sessão
  // morreu e o client HTTP já mandou o usuário para /login.
  source.onerror = () => {
    disconnect();
    // `sourceWorkspaceId` sobrevive ao disconnect de propósito: é ele que a
    // reabertura usa para voltar ao MESMO canal.
    if (reopening) return;
    reopening = setTimeout(() => {
      reopening = null;
      if (tokenStore.access) connect(sourceWorkspaceId);
    }, RETRY_MS);
  };
}

/**
 * Opens the app's one SSE connection to `/events/agent-runs`, idempotently.
 * Mount once, from a component that lives for every authenticated screen
 * (`AppLayout`) — polling stays the source of truth everywhere this stream
 * either never opens or silently drops.
 *
 * Reconnects whenever the selected workspace changes, closing the old
 * channel first — otherwise the user would keep receiving the previous
 * workspace's events after switching.
 */
export function useAgentRunEvents(): void {
  const { workspaceId } = useWorkspace();
  useEffect(() => {
    connect(workspaceId);
  }, [workspaceId]);
}
