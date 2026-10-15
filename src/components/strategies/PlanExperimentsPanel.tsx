import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useListExperiments } from '@/api/generated/hooks/experimentsHooks/useListExperiments';
import { usePlanStrategyExperiments } from '@/api/generated/hooks/strategiesHooks/usePlanStrategyExperiments';
import { useListAgentRuns } from '@/api/generated/hooks/agent-runsHooks/useListAgentRuns';
import type { RunsStatusEnumKey } from '@/api/generated/types/ListAgentRuns';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { useGetCreditPricing } from '@/api/generated/hooks/creditsHooks/useGetCreditPricing';
import { availableCredits } from '@/lib/credits';
import { apiErrorMessage } from '@/lib/api-errors';
import { canCarryExperiment } from '@/lib/hypothesis-actions';
import { missingPlanFields } from '@/lib/experiment-plan-gate';
import { PlanExperimentRun } from '@/components/strategies/PlanExperimentRun';
import { Help } from '@/components/Help';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const TASK_TYPE = 'propose-experiment';

// O input do run chega como unknown na resposta, igual ao output: parseado,
// nunca convertido com `as`.
const runInputSchema = z.object({ hypothesisId: z.string().uuid() });

function runHypothesisId(input: unknown): string | null {
  const parsed = runInputSchema.safeParse(input);
  return parsed.success ? parsed.data.hypothesisId : null;
}

interface PanelHypothesis {
  id: string;
  statement: string;
  status: Parameters<typeof canCarryExperiment>[0];
}

interface PlanExperimentsPanelProps {
  strategyId: string;
  hypotheses: PanelHypothesis[];
}

/**
 * Desenha de uma vez os testes que faltam neste plano.
 *
 * Existia um formulário por hipótese: um plano de três opções com três
 * hipóteses cada custava nove idas ao formulário antes de qualquer teste sair
 * do papel. O que a IA pode saber ela preenche; o que é do fundador — baseline,
 * meta e datas — fica pendente e nomeado no rascunho.
 */
export function PlanExperimentsPanel({ strategyId, hypotheses }: PlanExperimentsPanelProps) {
  const { t } = useTranslation();
  const [started, setStarted] = useState<{ hypothesisId: string; agentRunId: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const experiments = useListExperiments({ strategyId });
  const credits = useGetCredits();
  const pricing = useGetCreditPricing();

  const designed = experiments.data?.experiments ?? [];

  // Mesma seleção que o servidor faz em `findPlannableHypotheses`: sem
  // experimento e ainda testável. Espelho para poder mostrar o custo antes do
  // clique — a decisão de valer é do servidor.
  const pending = hypotheses.filter(
    (hypothesis) => canCarryExperiment(hypothesis.status) && !designed.some((e) => e.hypothesisId === hypothesis.id),
  );

  const costPerRun = pricing.data?.operations.find((operation) => operation.taskType === TASK_TYPE)?.credits ?? null;
  const total = costPerRun === null ? null : costPerRun * pending.length;
  const balance = credits.data ? availableCredits(credits.data) : null;
  // Orientação, não autorização: o worker autoriza cada run de novo. Até os dois
  // números resolverem, `short` fica falso para não bloquear quem tem saldo.
  const short = total !== null && balance !== null && balance < total;

  // Runs deste task type já em voo ou concluídos. Limite generoso: um plano de
  // três opções com três hipóteses cada gera nove.
  const history = useListAgentRuns({ taskType: TASK_TYPE, limit: 30 });

  // Um run recuperado só interessa se a hipótese dele ainda está pendente: se
  // já existe experimento, o run virou o que tinha de virar. E só conta como
  // "em andamento" se ainda pode virar experimento: um FAILED ou CANCELLED de
  // hipótese pendente não tem mais nada a esperar — mantê-lo aqui prenderia o
  // botão de gerar em toda visita futura, sem chance de retry, mesmo a própria
  // mensagem de falha parcial mandando tentar de novo.
  const recovered = (history.data?.runs ?? [])
    .map((run) => ({ agentRunId: run.id, hypothesisId: runHypothesisId(run.input), status: run.status }))
    .filter(
      (run): run is { agentRunId: string; hypothesisId: string; status: RunsStatusEnumKey } =>
        run.hypothesisId !== null,
    )
    .filter((run) => pending.some((hypothesis) => hypothesis.id === run.hypothesisId))
    .filter((run) => run.status === 'PENDING' || run.status === 'RUNNING' || run.status === 'COMPLETED');

  // O que esta sessão disparou vence: é a lista com a ordem do lote. O
  // recuperado entra só para o que não está nela.
  const tracked = [
    ...started,
    ...recovered.filter((run) => !started.some((s) => s.agentRunId === run.agentRunId)),
  ];

  const plan = usePlanStrategyExperiments({
    mutation: {
      onMutate: () => setError(null),
      onSuccess: (data) => {
        setStarted(data.runs);
        // O que o servidor recusou volta nomeado, para o fundador saber o que
        // ficou de fora em vez de contar cartões.
        if (data.failed.length) {
          setError(t('pages.strategies.autoPlan.partial', { count: data.failed.length }));
        }
      },
      onError: (mutationError) => setError(apiErrorMessage(mutationError, t('pages.strategies.autoPlan.startFailed'))),
    },
  });

  const nameOf = (hypothesisId: string) =>
    hypotheses.find((hypothesis) => hypothesis.id === hypothesisId)?.statement ?? hypothesisId;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm font-medium">
          {t('pages.strategies.autoPlan.title')}
          <Help title={t('pages.strategies.autoPlan.helpTitle')}>{t('pages.strategies.autoPlan.help')}</Help>
        </p>

        {pending.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              {t('pages.strategies.autoPlan.summary', { count: pending.length })}
              {total !== null && ` · ${t('pages.strategies.autoPlan.cost', { credits: total })}`}
            </p>

            {short && (
              <p className="text-sm text-destructive">
                {t('pages.strategies.autoPlan.short')}{' '}
                <Link to="/app/settings/billing" className="underline">
                  {t('pages.strategies.autoPlan.topUp')}
                </Link>
              </p>
            )}

            <Button
              size="sm"
              // `tracked` já só guarda o que está em voo ou concluído aguardando
              // virar experimento — FAILED/CANCELLED foi filtrado de `recovered`
              // acima, então um run que falhou para uma hipótese pendente não
              // trava o retry.
              disabled={short || plan.isPending || tracked.length > 0}
              onClick={() => plan.mutate({ id: strategyId })}
            >
              {t('pages.strategies.autoPlan.startBtn', { count: pending.length })}
            </Button>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {tracked.length > 0 && (
          <ul className="space-y-2">
            {tracked.map((run) => (
              <PlanExperimentRun key={run.agentRunId} agentRunId={run.agentRunId} label={nameOf(run.hypothesisId)} />
            ))}
          </ul>
        )}

        {designed.length > 0 && (
          <ul className="space-y-2">
            {designed.map((experiment) => {
              const missing = missingPlanFields(experiment);
              return (
                <li key={experiment.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Link to={`/app/experiments/${experiment.id}`} className="underline">
                    {experiment.name}
                  </Link>
                  {missing.length > 0 && (
                    <Badge variant="outline">{t('pages.strategies.autoPlan.missing', { count: missing.length })}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
