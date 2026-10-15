import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useGetExperiment, getExperimentQueryKey } from '@/api/generated/hooks/experimentsHooks/useGetExperiment';
import { usePlanExperiment } from '@/api/generated/hooks/experimentsHooks/usePlanExperiment';
import { useApproveExperiment } from '@/api/generated/hooks/experimentsHooks/useApproveExperiment';
import { useStartExperiment } from '@/api/generated/hooks/experimentsHooks/useStartExperiment';
import { usePauseExperiment } from '@/api/generated/hooks/experimentsHooks/usePauseExperiment';
import { useCompleteExperiment } from '@/api/generated/hooks/experimentsHooks/useCompleteExperiment';
import { useCancelExperiment } from '@/api/generated/hooks/experimentsHooks/useCancelExperiment';
import { EXPERIMENTS } from '@/api/modules';
import { allowedExperimentActions, type ExperimentAction } from '@/lib/experiment-actions';
import { apiErrorMessage } from '@/lib/api-errors';
import { Help } from '../components/Help';
import { PageHeader } from '../components/PageHeader';
import { LoopRail } from '../components/LoopRail';
import { LifecycleActions } from '@/components/LifecycleActions';
import { OutcomesSection } from '@/components/experiments/OutcomesSection';
import { LearningsSection } from '@/components/experiments/LearningsSection';
import { OutcomeInterpretation } from '@/components/experiments/OutcomeInterpretation';
import { MetricBindingCard } from '@/components/experiments/MetricBindingCard';
import { MeasurementProposalCard } from '@/components/experiments/MeasurementProposalCard';
import { useListOutcomes } from '@/api/generated/hooks/outcomesHooks/useListOutcomes';
import { useListLearnings } from '@/api/generated/hooks/learningsHooks/useListLearnings';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/** One labelled fact about the experiment, omitted entirely when unset. */
function Field({ label, help, value }: { label: string; help?: React.ReactNode; value: string | null }) {
  if (value === null || value === '') return null;
  return (
    <div>
      <p className="text-sm font-medium">
        {label}
        {help}
      </p>
      <p className="text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

export function ExperimentDetailPage() {
  const { t, i18n } = useTranslation();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  // O run que a gravação do número acabou de enfileirar. Vive aqui porque quem
  // grava (OutcomesSection) e quem lê (OutcomeInterpretation) são irmãos.
  const [interpretRunId, setInterpretRunId] = useState<string | null>(null);

  const experiment = useGetExperiment(id);
  // Same query keys the two sections below use, so this costs one request each
  // and not two: what the page needs from them is only whether the loop has
  // been carried any further than completing the experiment.
  const outcomes = useListOutcomes(id);
  const learnings = useListLearnings({ experimentId: id });

  // The server owns the status. Every transition refetches rather than patching
  // the cache from the button that was pressed: the mirror in
  // `lib/experiment-actions` can be stale (another tab, another member), and it
  // is the response that says what actually happened.
  const onSuccess = async () => {
    setActionError(null);
    await Promise.all([
      // Both keys on purpose: TanStack matches key prefixes structurally, and
      // the detail key is `[{url:'/experiments/:id', params}]`, which the list
      // root `[{url:'/experiments'}]` does NOT match. Invalidating only the
      // root would leave this very page showing the status it had before the
      // move it just performed.
      queryClient.invalidateQueries({ queryKey: getExperimentQueryKey(id) }),
      queryClient.invalidateQueries({ queryKey: EXPERIMENTS.queryKeyRoot }),
    ]);
  };
  const onError = (error: unknown) => setActionError(apiErrorMessage(error, t('pages.experiments.actionFailed')));
  const onMutate = () => setActionError(null);
  const mutation = { onMutate, onSuccess, onError };

  const plan = usePlanExperiment({ mutation });
  const approve = useApproveExperiment({ mutation });
  const start = useStartExperiment({ mutation });
  const pause = usePauseExperiment({ mutation });
  const complete = useCompleteExperiment({ mutation });
  const cancel = useCancelExperiment({ mutation });

  const byAction: Record<ExperimentAction, { mutate: (vars: { id: string }) => void; isPending: boolean }> = {
    plan,
    approve,
    start,
    pause,
    complete,
    cancel,
  };
  // One guard across all six: a second transition would target the status the
  // first one just left.
  const pending = Object.values(byAction).some((entry) => entry.isPending);

  if (experiment.isLoading) return <SectionLoading />;
  if (experiment.isError || !experiment.data) return <SectionLoadError refetch={[experiment.refetch]} />;

  const state = experiment.data.experiment;
  // The contract types these as date-time, so the generated types hand back a
  // Date — not the ISO string the raw payload carries.
  // Only once the experiment is over: asking a running experiment for its
  // result reads as "you are late" for one doing exactly what it should. Both
  // lists are awaited, because "not loaded yet" is not "none recorded".
  const nextStep =
    state.status !== 'COMPLETED' || !outcomes.data || !learnings.data
      ? null
      : outcomes.data.outcomes.length === 0
        ? 'measure'
        : learnings.data.learnings.length === 0
          ? 'learn'
          : null;

  const formatDate = (value: Date | string | null) =>
    value ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value)) : null;

  return (
    <div>
      <LoopRail />
      <PageHeader
        eyebrow={t('app.nav.experiments')}
        title={state.name}
        help={<Help title={t('pages.experiments.helpTitle')}>{t('pages.experiments.help')}</Help>}
        subtitle={state.description ?? t('pages.experiments.subtitle')}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge variant="muted">{t(`status.${state.status}`)}</Badge>
        <LifecycleActions
          moves={allowedExperimentActions(state.status)}
          labelKey="pages.experiments.action"
          pending={pending}
          onAct={(action) => byAction[action].mutate({ id })}
        />
      </div>

      {actionError && <p className="mb-4 text-sm text-destructive">{actionError}</p>}

      {/*
        Completing an experiment used to lead nowhere, which is precisely the
        half of the loop the MVP has to prove. The prompt names the next step
        and never suggests how the experiment went — a finished experiment with
        a disappointing number is still a finished experiment worth learning
        from.
      */}
      {nextStep && (
        <div className="mb-4 rounded-md border border-primary/30 bg-primary/5 p-4 text-sm">
          {t(`pages.experiments.next.${nextStep}`)}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="text-sm font-medium">
                {t('pages.experiments.metricLabel')}
                <Help title={t('pages.experiments.metricHelpTitle')}>{t('pages.experiments.metricHelp')}</Help>
              </p>
              <p className="font-mono text-sm text-muted-foreground">{state.metric}</p>
            </div>
            <div className="flex gap-8">
              <div>
                <p className="text-sm font-medium">
                  {t('pages.experiments.baseline')}
                  <Help title={t('pages.experiments.baselineHelpTitle')}>{t('pages.experiments.baselineHelp')}</Help>
                </p>
                <p className="font-display text-2xl font-extrabold">
                  {state.baselineValue === null ? '—' : state.baselineValue}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">
                  {t('pages.experiments.target')}
                  <Help title={t('pages.experiments.targetHelpTitle')}>{t('pages.experiments.targetHelp')}</Help>
                </p>
                <p className="font-display text-2xl font-extrabold text-primary">
                  {state.targetValue === null ? '—' : state.targetValue}
                </p>
              </div>
            </div>
            <Field
              label={t('pages.experiments.successCriteria')}
              help={
                <Help title={t('pages.experiments.successHelpTitle')}>{t('pages.experiments.successHelp')}</Help>
              }
              value={state.successCriteria}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <Field label={t('pages.experiments.objective')} value={state.objective} />
            <Field label={t('pages.experiments.channel')} value={state.channel} />
            <Field label={t('pages.experiments.audience')} value={state.audience} />
            <Field
              label={t('pages.experiments.window')}
              value={
                formatDate(state.startDate) && formatDate(state.endDate)
                  ? `${formatDate(state.startDate)} → ${formatDate(state.endDate)}`
                  : (formatDate(state.startDate) ?? formatDate(state.endDate))
              }
            />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="space-y-4">
          <MeasurementProposalCard
            experimentId={id}
            // Só depois de o experimento terminar e enquanto não houver número:
            // pedir a leitura de um experimento correndo mede meio teste.
            canMeasure={state.status === 'COMPLETED' && (outcomes.data?.outcomes.length ?? 0) === 0}
            onInterpretationStarted={setInterpretRunId}
          />
          <OutcomesSection
            experimentId={id}
            metric={state.metric}
            targetValue={state.targetValue}
            onInterpretationStarted={setInterpretRunId}
          />
        </div>
        <div className="space-y-4">
          <MetricBindingCard experimentId={id} />
          <OutcomeInterpretation
            experimentId={id}
            canRun={state.status === 'COMPLETED' && (outcomes.data?.outcomes.length ?? 0) > 0}
            adoptRunId={interpretRunId}
          />
          <LearningsSection experimentId={id} />
        </div>
      </div>
    </div>
  );
}
