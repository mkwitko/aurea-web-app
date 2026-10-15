import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCancelAgentRun } from '@/api/generated/hooks/agent-runsHooks/useCancelAgentRun';
import { useCreateAgentRun } from '@/api/generated/hooks/agent-runsHooks/useCreateAgentRun';
import { useListAgentRuns } from '@/api/generated/hooks/agent-runsHooks/useListAgentRuns';
import { useGetAgentRun } from '@/api/generated/hooks/agent-runsHooks/useGetAgentRun';
import type { GetAgentRun200StatusEnumKey } from '@/api/generated/types/GetAgentRun';
import { apiErrorMessage } from '@/lib/api-errors';

/**
 * O run em voo que o backend apontou ao recusar este pedido (409
 * AGENT_RUN_IN_PROGRESS). Ele não é sobre o que ESTE botão pediu — pode ser
 * outra seção do mesmo contexto — mas é o que está ocupando o lugar, e é ele
 * que o fundador precisa ver correndo (e poder cancelar) para conseguir
 * seguir. Body não confiável: cada passo é checado.
 */
function inProgressRunId(error: unknown): string | null {
  const data = (error as { data?: { error?: { code?: unknown; details?: unknown } } } | null | undefined)?.data;
  if (data?.error?.code !== 'AUR-T0035') return null;
  const runId = (data.error.details as { runId?: unknown } | null | undefined)?.runId;
  return typeof runId === 'string' && runId.length > 0 ? runId : null;
}

// Typed against the generated enum, not string[], so a typo in one of these
// three literals is a compile error rather than a silently-broken check.
const TERMINAL: GetAgentRun200StatusEnumKey[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

export type FillRunState = 'idle' | 'starting' | 'running' | 'done' | 'failed';

export interface UseFillRun {
  state: FillRunState;
  runId: string | null;
  output: unknown;
  error: string | null;
  start(): void;
  isStarting: boolean;
  /** Quando o run em voo começou. Base do cronômetro na tela. */
  startedAt: Date | null;
  /** O run em voo é de outro pedido (409): quem espera não é este botão. */
  isForeign: boolean;
  /**
   * O run ativo veio da recuperação, não de um clique nesta montagem.
   *
   * A adoção é por montagem e ignora o status (ver a nota no topo), então um
   * run COMPLETED continua sendo adotado para sempre — toda vez que a tela
   * monta. Quem reage à conclusão com um efeito colateral que só cabe uma vez
   * (navegar, por exemplo) precisa saber a diferença entre "acabou agora" e
   * "já tinha acabado antes de eu chegar aqui".
   */
  isAdopted: boolean;
  cancel(): void;
  isCancelling: boolean;
}

/**
 * O ciclo de vida de um run de preenchimento: começar, adotar o mais recente
 * ao montar, esperar, terminar. Compartilhado pelos sete botões "gerar com
 * IA" — `ResearchPanel` e `ProposeStrategies` já tinham essa mesma máquina
 * escrita à mão cada um por si; esta é a versão única.
 *
 * A adoção existe porque o run sobrevive ao recarregamento da página, e um
 * fundador que recarregou no meio (o caso que dói no celular) não pode perder
 * o resultado que ele já pagou. Ela adota independentemente do status: filtrar
 * por RUNNING perderia justamente o run que terminou enquanto a página
 * recarregava.
 */
export function useFillRun({
  taskType,
  input,
  matchesInput,
  startFailedMessage,
}: {
  taskType: string;
  input: Record<string, unknown> | null;
  matchesInput?: (input: unknown) => boolean;
  startFailedMessage: string;
}): UseFillRun {
  const { t } = useTranslation();
  const [runId, setRunId] = useState<string | null>(null);
  const [foreignRunId, setForeignRunId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const create = useCreateAgentRun({
    mutation: {
      onMutate: () => {
        setStartError(null);
        setForeignRunId(null);
      },
      onError: (error) => {
        // 409: existe um run em voo no mesmo escopo. Adotá-lo em vez de só
        // mostrar o erro é o que dá saída ao fundador — ele vê há quanto tempo
        // roda e pode cancelar. Sem isso, "gerar" numa segunda seção só
        // devolveria uma mensagem e nada a fazer.
        const active = inProgressRunId(error);
        if (active) {
          setForeignRunId(active);
          setRunId(active);
          return;
        }
        setStartError(apiErrorMessage(error, startFailedMessage));
      },
      onSuccess: (data) => setRunId(data.id),
    },
  });

  const cancelRun = useCancelAgentRun({
    mutation: {
      // Volta ao botão em vez de mostrar o run cancelado: o fundador cancelou
      // para fazer outra coisa. `dismissed` impede que a query de recuperação
      // readote o mesmo run no próximo refetch.
      onSuccess: (data) => {
        setDismissed(data.id);
        setRunId(null);
        setForeignRunId(null);
      },
      onError: (error) => setStartError(apiErrorMessage(error, startFailedMessage)),
    },
  });

  const latest = useListAgentRuns({ taskType, limit: 1 });
  const candidate = latest.data?.runs[0] ?? null;

  // Um run adotado tem que ser sobre a MESMA coisa que este botão preenche: o
  // run mais recente de propose-context-section pode ser de outra seção, e
  // aplicá-lo escreveria a proposta errada no formulário certo.
  const adoptable =
    candidate && candidate.id !== dismissed && (!matchesInput || matchesInput(candidate.input))
      ? candidate.id
      : null;

  const activeId = runId ?? adoptable;

  const run = useGetAgentRun(activeId ?? undefined, {
    query: {
      enabled: activeId !== null,
      // Para de pesquisar quando o run é terminal, e também quando a própria
      // pesquisa está falhando: sem a segunda condição, `state.data` nunca
      // vira verdadeiro e o poll continuaria a cada 30s enquanto o fundador
      // olha para um card de erro. O stream SSE (`useAgentRunEvents`) é o que
      // permite esse piso de 30s em vez dos antigos 2s — ele é o atalho de
      // latência, o poll continua sendo a rede de segurança.
      refetchInterval: (query) =>
        query.state.status === 'error' ||
        (query.state.data && TERMINAL.includes(query.state.data.status))
          ? false
          : 30000,
    },
  });

  // `dismissed` guarda o id, e não um booleano: a query de recuperação readota
  // o mais recente sempre que refaz a busca (reconexão, invalidação), então um
  // booleano seria apagado no próximo refetch e o run voltaria sozinho.
  //
  // Este efeito não existe para o caminho comum (create bem-sucedido devolve
  // um id novo, e `runId` passa a vencer `adoptable` sozinho, sem precisar do
  // efeito). Ele existe para o caso em que o backend deduplica: `POST
  // /agent-runs` devolve o run ATIVO existente em vez de criar outro quando
  // taskType + hash do input batem e o run anterior ainda está PENDING/RUNNING
  // (ver `findActiveByHash` em `create-agent-run.service.ts`). Se o fundador
  // clicar "gerar de novo" enquanto o run que acabou de sair ainda está ativo
  // e com o mesmo input, o id que volta é exatamente o id que `dismissed`
  // acabou de guardar — e sem limpar `dismissed` aqui, ele ficaria bloqueando
  // esse mesmo run para sempre nesta montagem, mesmo depois de `runId` deixar
  // de apontar pra ele por qualquer motivo futuro.
  useEffect(() => {
    if (runId && runId === dismissed) setDismissed(null);
  }, [runId, dismissed]);

  const status = run.data?.status ?? null;

  const state: FillRunState = (() => {
    if (create.isPending) return 'starting';
    if (activeId === null) return 'idle';
    if (run.isError) return 'failed';
    if (status === 'COMPLETED') return 'done';
    if (status === 'FAILED' || status === 'CANCELLED') return 'failed';
    return 'running';
  })();

  return {
    state,
    runId: activeId,
    startedAt: run.data?.createdAt ? new Date(run.data.createdAt) : null,
    isForeign: activeId !== null && activeId === foreignRunId,
    // `runId` só é escrito por `create` (sucesso ou 409): é exatamente o
    // conjunto dos runs que ESTA montagem pediu. Tudo o que sobra em
    // `activeId` chegou por `adoptable`.
    isAdopted: runId === null && activeId !== null,
    cancel: () => {
      if (!activeId || cancelRun.isPending) return;
      cancelRun.mutate({ id: activeId });
    },
    isCancelling: cancelRun.isPending,
    output: status === 'COMPLETED' ? (run.data?.output ?? null) : null,
    error: startError ?? (state === 'failed' ? (run.data?.error ?? t('ai.fill.failed')) : null),
    start: () => {
      if (!input) return;
      // Registra o run que está sendo deixado para trás antes de criar o novo:
      // sem isso a query de recuperação readotaria o mesmo run e o botão
      // "gerar de novo" pareceria não fazer nada.
      setDismissed(activeId);
      // `runId` também é zerado aqui, e não só `dismissed`: a partir da SEGUNDA
      // vez que `start` é chamado com sucesso, `runId` já não é mais nulo — ele
      // vence `adoptable` incondicionalmente (`runId ?? adoptable`) e continua
      // vencendo durante todo o intervalo pendente do novo create, então sem
      // este reset `runId`/`output` expostos continuariam descrevendo o run
      // ANTERIOR até o novo create resolver, não o card neutro de "starting"
      // que o resto da tela espera. `create.isPending` já cobre `state`, mas
      // `runId` e `output` são campos próprios que um consumidor pode ler sem
      // passar por `state` primeiro.
      setRunId(null);
      create.mutate({ data: { taskType, input } });
    },
    isStarting: create.isPending,
  };
}
