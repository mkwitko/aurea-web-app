import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useListHypotheses } from '@/api/generated/hooks/hypothesesHooks/useListHypotheses';
import { useCreateExperiment } from '@/api/generated/hooks/experimentsHooks/useCreateExperiment';
import { EXPERIMENTS } from '@/api/modules';
import { canCarryExperiment } from '@/lib/hypothesis-actions';
import { apiErrorMessage } from '@/lib/api-errors';
import { EXPERIMENT_FILL_PATHS } from '@/lib/fill-paths';
import { AiFillButton } from '@/components/ai/AiFillButton';
import { experimentFormSchema, type ExperimentFormValues } from '@/schemas/experiments';
import { PageHeader } from '../components/PageHeader';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextField } from '@/components/form/TextField';
import { TextAreaField } from '@/components/form/TextAreaField';
import { NumberField } from '@/components/form/NumberField';
import { SelectField } from '@/components/form/SelectField';

/**
 * Every field `propose-experiment` can fill, all optional: the model may
 * leave any of them out. Mirrors `ExperimentFilled` in
 * `back/src/ai/agents/fill/propose-experiment.ts`. `baselineValue`,
 * `targetValue`, `startDate` and `endDate` are not here — the agent asks for
 * them instead (see `EXPERIMENT_FILL_PATHS`), so they arrive through
 * `onAnswer`.
 */
const experimentFilledSchema = z.object({
  name: z.string().optional(),
  metric: z.string().optional(),
  description: z.string().optional(),
  objective: z.string().optional(),
  channel: z.string().optional(),
  audience: z.string().optional(),
  successCriteria: z.string().optional(),
});

export function ExperimentNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hypotheses = useListHypotheses();

  const { control, handleSubmit, setValue, getValues, watch } = useForm<ExperimentFormValues>({
    resolver: zodResolver(experimentFormSchema),
    defaultValues: {
      hypothesisId: '',
      name: '',
      metric: '',
      description: '',
      objective: '',
      channel: '',
      audience: '',
      baselineValue: undefined,
      targetValue: undefined,
      successCriteria: '',
      startDate: '',
      endDate: '',
    },
  });
  const hypothesisId = watch('hypothesisId');

  const create = useCreateExperiment({
    mutation: {
      onSuccess: (data) => {
        void queryClient.invalidateQueries({ queryKey: EXPERIMENTS.queryKeyRoot });
        // Straight to the experiment: the next thing to do is plan and start
        // it, and both live there.
        navigate(`/app/experiments/${data.experiment.id}`);
      },
    },
  });

  const onSubmit = handleSubmit((values) => {
    create.mutate({
      data: {
        hypothesisId: values.hypothesisId,
        name: values.name,
        metric: values.metric,
        description: values.description || undefined,
        objective: values.objective || undefined,
        channel: values.channel || undefined,
        audience: values.audience || undefined,
        baselineValue: values.baselineValue,
        targetValue: values.targetValue,
        successCriteria: values.successCriteria || undefined,
        startDate: values.startDate ? new Date(values.startDate) : undefined,
        endDate: values.endDate ? new Date(values.endDate) : undefined,
      },
    });
  });

  if (hypotheses.isLoading) return <SectionLoading />;
  if (hypotheses.isError || !hypotheses.data) return <SectionLoadError refetch={[hypotheses.refetch]} />;

  // Only what is still worth testing: a VALIDATED or REJECTED hypothesis has
  // nothing left to learn from an experiment.
  const testable = hypotheses.data.hypotheses.filter((hypothesis) => canCarryExperiment(hypothesis.status));

  return (
    <div>
      <Link
        to="/app/experiments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {t('crud.back')}
      </Link>
      <PageHeader
        eyebrow={t('app.nav.experiments')}
        title={t('pages.experiments.newTitle')}
        subtitle={t('pages.experiments.newSubtitle')}
      />

      <Card>
        <CardContent className="p-6">
          {testable.length === 0 ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>{t('pages.experiments.needHypothesis')}</p>
              <Button asChild>
                <Link to="/app/strategies">{t('app.nav.strategies')}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <Controller
                control={control}
                name="hypothesisId"
                render={({ field, fieldState }) => (
                  <SelectField
                    htmlFor="experiment-hypothesis"
                    label={t('pages.experiments.hypothesis')}
                    helpTitle={t('pages.hypotheses.helpTitle')}
                    help={t('pages.hypotheses.help')}
                    placeholder={t('pages.experiments.hypothesisSelect')}
                    value={field.value || undefined}
                    onChange={(value) => {
                      field.onChange(value ?? '');
                      // Propose, don't ask: the hypothesis already names the
                      // metric it is about, so carry it over rather than making
                      // the user retype it. Only when the field is untouched.
                      const chosen = testable.find((hypothesis) => hypothesis.id === value);
                      if (chosen?.targetMetric && !getValues('metric')) setValue('metric', chosen.targetMetric);
                    }}
                    options={testable.map((hypothesis) => ({ value: hypothesis.id, labelKey: hypothesis.statement }))}
                    translate={(label) => label}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />

              <AiFillButton
                taskType="propose-experiment"
                input={hypothesisId ? { hypothesisId } : null}
                allowedPaths={EXPERIMENT_FILL_PATHS}
                label={t('ai.fill.experiment.label')}
                blockedReason={hypothesisId ? null : { message: t('ai.fill.experiment.needsHypothesis') }}
                onFilled={(filled) => {
                  const parsed = experimentFilledSchema.safeParse(filled);
                  if (!parsed.success) return;
                  for (const [key, value] of Object.entries(parsed.data)) {
                    if (value === undefined) continue;
                    setValue(key as keyof ExperimentFormValues, value, { shouldDirty: true });
                  }
                }}
                onAnswer={(path, value) => {
                  // Converted here, not in the panel: `AiFillPanel` only ever
                  // knows the answer is a `string | number`, and this form is
                  // the one that knows which of these four are number fields
                  // and which are date-typed `TextField`s.
                  if (path === 'baselineValue' || path === 'targetValue') {
                    setValue(path, Number(value), { shouldDirty: true });
                  } else if (path === 'startDate' || path === 'endDate') {
                    setValue(path, String(value), { shouldDirty: true });
                  }
                }}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <TextField
                      htmlFor="experiment-name"
                      label={t('pages.experiments.name')}
                      placeholder={t('pages.experiments.namePh')}
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="metric"
                  render={({ field, fieldState }) => (
                    <TextField
                      htmlFor="experiment-metric"
                      label={t('pages.experiments.metricLabel')}
                      helpTitle={t('pages.experiments.metricHelpTitle')}
                      help={t('pages.experiments.metricHelp')}
                      placeholder={t('pages.experiments.metricPh')}
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                    />
                  )}
                />
              </div>

              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <TextAreaField
                    htmlFor="experiment-description"
                    label={t('pages.experiments.description')}
                    placeholder={t('pages.experiments.descriptionPh')}
                    optional
                    optionalLabel={t('common.optional')}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              <Controller
                control={control}
                name="objective"
                render={({ field, fieldState }) => (
                  <TextField
                    htmlFor="experiment-objective"
                    label={t('pages.experiments.objective')}
                    placeholder={t('pages.experiments.objectivePh')}
                    optional
                    optionalLabel={t('common.optional')}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="channel"
                  render={({ field, fieldState }) => (
                    <TextField
                      htmlFor="experiment-channel"
                      label={t('pages.experiments.channel')}
                      placeholder={t('pages.experiments.channelPh')}
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
                  name="audience"
                  render={({ field, fieldState }) => (
                    <TextField
                      htmlFor="experiment-audience"
                      label={t('pages.experiments.audience')}
                      placeholder={t('pages.experiments.audiencePh')}
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
                  name="baselineValue"
                  render={({ field, fieldState }) => (
                    <NumberField
                      htmlFor="experiment-baseline"
                      label={t('pages.experiments.baseline')}
                      helpTitle={t('pages.experiments.baselineHelpTitle')}
                      help={t('pages.experiments.baselineHelp')}
                      optional
                      optionalLabel={t('common.optional')}
                      placeholder="0"
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="targetValue"
                  render={({ field, fieldState }) => (
                    <NumberField
                      htmlFor="experiment-target"
                      label={t('pages.experiments.target')}
                      helpTitle={t('pages.experiments.targetHelpTitle')}
                      help={t('pages.experiments.targetHelp')}
                      optional
                      optionalLabel={t('common.optional')}
                      placeholder="0"
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
                  name="startDate"
                  render={({ field }) => (
                    <TextField
                      htmlFor="experiment-start"
                      label={t('pages.experiments.startDate')}
                      type="date"
                      optional
                      optionalLabel={t('common.optional')}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <TextField
                      htmlFor="experiment-end"
                      label={t('pages.experiments.endDate')}
                      type="date"
                      optional
                      optionalLabel={t('common.optional')}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>

              <Controller
                control={control}
                name="successCriteria"
                render={({ field, fieldState }) => (
                  <TextField
                    htmlFor="experiment-success"
                    label={t('pages.experiments.successCriteria')}
                    helpTitle={t('pages.experiments.successHelpTitle')}
                    help={t('pages.experiments.successHelp')}
                    placeholder={t('pages.experiments.successPh')}
                    optional
                    optionalLabel={t('common.optional')}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />

              {create.isError && (
                <p className="text-sm text-destructive">
                  {apiErrorMessage(create.error, t('pages.experiments.createFailed'))}
                </p>
              )}

              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? t('common.creating') : t('pages.experiments.createBtn')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
