import { useState } from 'react';
import { z } from 'zod';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { useGetStrategy } from '@/api/generated/hooks/strategiesHooks/useGetStrategy';
import { useListHypotheses } from '@/api/generated/hooks/hypothesesHooks/useListHypotheses';
import { useCreateHypothesis } from '@/api/generated/hooks/hypothesesHooks/useCreateHypothesis';
import { useProposeHypothesis } from '@/api/generated/hooks/hypothesesHooks/useProposeHypothesis';
import { useMarkHypothesisTested } from '@/api/generated/hooks/hypothesesHooks/useMarkHypothesisTested';
import { useValidateHypothesis } from '@/api/generated/hooks/hypothesesHooks/useValidateHypothesis';
import { useRejectHypothesis } from '@/api/generated/hooks/hypothesesHooks/useRejectHypothesis';
import { HYPOTHESES } from '@/api/modules';
import { allowedHypothesisActions, canCarryExperiment, type HypothesisAction } from '@/lib/hypothesis-actions';
import { apiErrorMessage } from '@/lib/api-errors';
import { hypothesisFormSchema, type HypothesisFormValues } from '@/schemas/hypotheses';
import { NO_FILL_PATHS } from '@/lib/fill-paths';
import { AiFillButton } from '@/components/ai/AiFillButton';
import { PlanExperimentsPanel } from '@/components/strategies/PlanExperimentsPanel';
import { Help } from '../components/Help';
import { PageHeader } from '../components/PageHeader';
import { LoopRail } from '../components/LoopRail';
import { LifecycleActions } from '@/components/LifecycleActions';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TextField } from '@/components/form/TextField';
import { SelectField } from '@/components/form/SelectField';

const CONFIDENCE = ['LOW', 'MEDIUM', 'HIGH', 'VERIFIED'] as const;

// Mirrors the `chosen` list in `propose-hypothesis.ts`'s own `precheck`
// (`back/src/ai/agents/fill/propose-hypothesis.ts`) exactly: the two
// statuses that mean "this is the plan". Any other status has to give the
// founder the same refusal the server would, before a run is paid for.
const STRATEGY_CHOSEN = ['APPROVED', 'ACTIVE'];

/**
 * Every field `propose-hypothesis` can fill, all optional: the model may
 * leave any of them out. Mirrors `HypothesisFilled` in
 * `back/src/ai/agents/fill/propose-hypothesis.ts` — `confidence` there has no
 * `VERIFIED` (an untested hypothesis has verified nothing), unlike this
 * page's own `CONFIDENCE`, which a founder can still pick by hand once one
 * has been tested.
 */
const hypothesisFilledSchema = z.object({
  statement: z.string().optional(),
  rationale: z.string().optional(),
  expectedOutcome: z.string().optional(),
  targetMetric: z.string().optional(),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export function StrategyDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const strategy = useGetStrategy(id);
  // Filtered server-side: listing every hypothesis in the workspace and
  // filtering here would grow with the account for no reason.
  const hypotheses = useListHypotheses({ strategyId: id });

  const refreshHypotheses = () => queryClient.invalidateQueries({ queryKey: HYPOTHESES.queryKeyRoot });

  const { control, handleSubmit, reset, setValue } = useForm<HypothesisFormValues>({
    resolver: zodResolver(hypothesisFormSchema),
    defaultValues: { statement: '', rationale: '', expectedOutcome: '', targetMetric: '', confidence: undefined },
  });

  const create = useCreateHypothesis({
    mutation: {
      onSuccess: async () => {
        reset();
        await refreshHypotheses();
      },
      onError: (error) => setActionError(apiErrorMessage(error, t('pages.hypotheses.createFailed'))),
    },
  });

  // The status the server reports is the one that counts, so every move
  // refetches instead of patching the row from the button that was pressed.
  const mutation = {
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      await refreshHypotheses();
    },
    onError: (error: unknown) => setActionError(apiErrorMessage(error, t('pages.hypotheses.actionFailed'))),
  };

  const propose = useProposeHypothesis({ mutation });
  const tested = useMarkHypothesisTested({ mutation });
  const validate = useValidateHypothesis({ mutation });
  const reject = useRejectHypothesis({ mutation });

  const byAction: Record<HypothesisAction, { mutate: (vars: { id: string }) => void; isPending: boolean }> = {
    propose,
    tested,
    validate,
    reject,
  };
  const pending = Object.values(byAction).some((entry) => entry.isPending);

  if (strategy.isLoading || hypotheses.isLoading) return <SectionLoading />;
  if (strategy.isError || hypotheses.isError || !strategy.data || !hypotheses.data) {
    return <SectionLoadError refetch={[strategy.refetch, hypotheses.refetch]} />;
  }

  const state = strategy.data.strategy;
  const onSubmit = handleSubmit((values) => {
    create.mutate({
      data: {
        strategyId: id,
        statement: values.statement,
        rationale: values.rationale || undefined,
        expectedOutcome: values.expectedOutcome || undefined,
        targetMetric: values.targetMetric || undefined,
        confidence: values.confidence,
      },
    });
  });

  return (
    <div>
      <LoopRail />
      <Link
        to="/app/strategies"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t('crud.back')}
      </Link>
      <PageHeader
        eyebrow={t('app.nav.strategies')}
        title={state.name}
        help={<Help title={t('pages.strategies.helpTitle')}>{t('pages.strategies.help')}</Help>}
        subtitle={state.objective ?? t('pages.strategies.subtitle')}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge variant="muted">{t(`status.${state.status}`)}</Badge>
        {state.growthMechanism && (
          <span className="font-mono text-xs text-muted-foreground">
            {t('pages.strategies.mechanismLabel')}: {state.growthMechanism}
          </span>
        )}
      </div>

      {state.strategicThesis && (
        <Card className="mb-6">
          <CardContent className="p-5">
            <p className="text-sm font-medium">
              {t('pages.strategies.thesis')}
              <Help title={t('pages.strategies.thesisHelpTitle')}>{t('pages.strategies.thesisHelp')}</Help>
            </p>
            <p className="text-sm text-muted-foreground">{state.strategicThesis}</p>
          </CardContent>
        </Card>
      )}

      {id && hypotheses.data && (
        <div className="mb-6">
          <PlanExperimentsPanel
            strategyId={id}
            hypotheses={hypotheses.data.hypotheses.map((hypothesis) => ({
              id: hypothesis.id,
              statement: hypothesis.statement,
              status: hypothesis.status,
            }))}
          />
        </div>
      )}

      <h2 className="mb-3 font-display text-xl font-bold">
        {t('pages.hypotheses.title')}
        <Help title={t('pages.hypotheses.helpTitle')}>{t('pages.hypotheses.help')}</Help>
      </h2>

      {actionError && <p className="mb-4 text-sm text-destructive">{actionError}</p>}

      <div className="mb-6 space-y-3">
        {hypotheses.data.hypotheses.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {t('pages.hypotheses.empty')}
            </CardContent>
          </Card>
        )}
        {hypotheses.data.hypotheses.map((hypothesis) => (
          <Card key={hypothesis.id}>
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{hypothesis.statement}</span>
                <Badge variant="muted">{t(`status.${hypothesis.status}`)}</Badge>
                <Badge variant="default">{t(`enums.confidence.${hypothesis.confidence}`)}</Badge>
              </div>
              {hypothesis.expectedOutcome && (
                <p className="text-sm text-muted-foreground">{hypothesis.expectedOutcome}</p>
              )}
              {hypothesis.targetMetric && (
                <p className="font-mono text-xs text-muted-foreground">
                  {t('pages.experiments.metricLabel')}: {hypothesis.targetMetric}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <LifecycleActions
                  moves={allowedHypothesisActions(hypothesis.status)}
                  labelKey="pages.hypotheses.action"
                  pending={pending}
                  onAct={(action) => byAction[action].mutate({ id: hypothesis.id })}
                />
                {/* Only while there is still something to learn: an experiment
                    for a settled hypothesis tests nothing. */}
                {canCarryExperiment(hypothesis.status) && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/app/experiments/new">
                      <FlaskConical className="size-4" /> {t('pages.hypotheses.designExperiment')}
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          <h3 className="mb-4 font-display text-lg font-bold">{t('pages.hypotheses.addTitle')}</h3>

          <div className="mb-5">
            <AiFillButton
              taskType="propose-hypothesis"
              input={{ strategyId: id }}
              allowedPaths={NO_FILL_PATHS}
              label={t('ai.fill.hypothesis.label')}
              blockedReason={
                STRATEGY_CHOSEN.includes(state.status) ? null : { message: t('ai.fill.hypothesis.needsApproval') }
              }
              onFilled={(filled) => {
                const parsed = hypothesisFilledSchema.safeParse(filled);
                if (!parsed.success) return;
                for (const [key, value] of Object.entries(parsed.data)) {
                  if (value === undefined) continue;
                  setValue(key as keyof HypothesisFormValues, value, { shouldDirty: true });
                }
              }}
              onAnswer={() => undefined}
            />
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <Controller
              control={control}
              name="statement"
              render={({ field, fieldState }) => (
                <TextField
                  htmlFor="hypothesis-statement"
                  label={t('pages.hypotheses.statement')}
                  helpTitle={t('pages.hypotheses.statementHelpTitle')}
                  help={t('pages.hypotheses.statementHelp')}
                  placeholder={t('pages.hypotheses.statementPh')}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                />
              )}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={control}
                name="expectedOutcome"
                render={({ field, fieldState }) => (
                  <TextField
                    htmlFor="hypothesis-outcome"
                    label={t('pages.hypotheses.expectedOutcome')}
                    placeholder={t('pages.hypotheses.expectedOutcomePh')}
                    optional
                    optionalLabel={t('common.optional')}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
              <Controller
                control={control}
                name="targetMetric"
                render={({ field, fieldState }) => (
                  <TextField
                    htmlFor="hypothesis-metric"
                    label={t('pages.experiments.metricLabel')}
                    helpTitle={t('pages.experiments.metricHelpTitle')}
                    help={t('pages.experiments.metricHelp')}
                    placeholder={t('pages.experiments.metricPh')}
                    optional
                    optionalLabel={t('common.optional')}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={control}
                name="rationale"
                render={({ field, fieldState }) => (
                  <TextField
                    htmlFor="hypothesis-rationale"
                    label={t('pages.hypotheses.rationale')}
                    placeholder={t('pages.hypotheses.rationalePh')}
                    optional
                    optionalLabel={t('common.optional')}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
              <Controller
                control={control}
                name="confidence"
                render={({ field, fieldState }) => (
                  <SelectField
                    htmlFor="hypothesis-confidence"
                    label={t('pages.hypotheses.confidence')}
                    helpTitle={t('pages.hypotheses.confidenceHelpTitle')}
                    help={t('pages.hypotheses.confidenceHelp')}
                    placeholder={t('pages.hypotheses.confidenceSelect')}
                    optional
                    optionalLabel={t('common.optional')}
                    value={field.value}
                    onChange={field.onChange}
                    options={CONFIDENCE.map((level) => ({ value: level, labelKey: `enums.confidence.${level}` }))}
                    translate={t}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t('common.adding') : t('pages.hypotheses.addBtn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
