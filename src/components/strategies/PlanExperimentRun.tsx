import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useGetAgentRun } from '@/api/generated/hooks/agent-runsHooks/useGetAgentRun';
import { useCreateExperimentFromProposal } from '@/api/generated/hooks/experimentsHooks/useCreateExperimentFromProposal';
import type { GetAgentRun200StatusEnumKey } from '@/api/generated/types/GetAgentRun';
import { EXPERIMENTS } from '@/api/modules';
import { apiErrorMessage } from '@/lib/api-errors';
import { Button } from '@/components/ui/button';

const TERMINAL: GetAgentRun200StatusEnumKey[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

interface PlanExperimentRunProps {
  agentRunId: string;
  /** Nome da hipótese que este run está desenhando — o fundador não lê uuid. */
  label: string;
}

/**
 * Um run do lote: espera, e ao terminar transforma o output em experimento.
 *
 * A materialização é chamada daqui, do cliente, e não do worker: não existe
 * passo pós-run no runner, e criar esse conceito é maior que este escopo. Fechar
 * o navegador não perde nada — o run termina, o output fica gravado, e o painel
 * oferece a criação na próxima visita. `POST /experiments/from-proposal` é
 * idempotente pela unique de `sourceAgentRunId`, então duas abas fazendo isto ao
 * mesmo tempo criam um experimento só.
 */
export function PlanExperimentRun({ agentRunId, label }: PlanExperimentRunProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const run = useGetAgentRun(agentRunId, {
    query: {
      refetchInterval: (query) =>
        query.state.status === 'error' || (query.state.data && TERMINAL.includes(query.state.data.status))
          ? false
          : 2000,
    },
  });

  const create = useCreateExperimentFromProposal({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: EXPERIMENTS.queryKeyRoot }),
    },
  });

  const done = run.data?.status === 'COMPLETED';

  // Dispara uma vez, quando o run fica COMPLETED. `isIdle` é a trava: sem ela o
  // efeito reenviaria a cada refetch, e mesmo sendo idempotente no servidor
  // seria uma chamada por polling.
  useEffect(() => {
    if (done && create.isIdle) create.mutate({ data: { agentRunId } });
  }, [done, create, agentRunId]);

  if (run.isError || run.data?.status === 'FAILED' || run.data?.status === 'CANCELLED') {
    return (
      <li className="flex items-center justify-between gap-2 text-sm">
        <span className="text-destructive">{t('pages.strategies.autoPlan.runFailed', { name: label })}</span>
      </li>
    );
  }

  if (create.isError) {
    return (
      <li className="flex items-center justify-between gap-2 text-sm">
        <span className="text-destructive">{apiErrorMessage(create.error, t('pages.strategies.autoPlan.createFailed'))}</span>
        <Button size="sm" variant="outline" onClick={() => create.mutate({ data: { agentRunId } })}>
          {t('pages.strategies.autoPlan.retryBtn')}
        </Button>
      </li>
    );
  }

  if (create.isSuccess) {
    return (
      <li className="text-sm text-muted-foreground">{t('pages.strategies.autoPlan.runDone', { name: label })}</li>
    );
  }

  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {t('pages.strategies.autoPlan.runWorking', { name: label })}
    </li>
  );
}
