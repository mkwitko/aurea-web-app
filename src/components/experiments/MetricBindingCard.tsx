import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import {
  useGetMetricBinding,
  getMetricBindingQueryKey,
} from '@/api/generated/hooks/experimentsHooks/useGetMetricBinding';
import { usePutMetricBinding } from '@/api/generated/hooks/experimentsHooks/usePutMetricBinding';
import { useRemoveMetricBinding } from '@/api/generated/hooks/experimentsHooks/useRemoveMetricBinding';
import { useListIntegrations } from '@/api/generated/hooks/integrationsHooks/useListIntegrations';
import { useFillRun } from '@/components/ai/useFillRun';
import { SpecialistByline } from '@/components/ai/SpecialistByline';
import { RunningRunCard } from '@/components/ai/RunningRunCard';
import { parseRunExperimentId } from '@/schemas/interpret-outcome';
import { metricBindingFormSchema, proposeMetricBindingOutput, type MetricBindingFormValues } from '@/schemas/metric-binding';
import { apiErrorMessage } from '@/lib/api-errors';
import { availableCredits } from '@/lib/credits';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { useGetCreditPricing } from '@/api/generated/hooks/creditsHooks/useGetCreditPricing';
import { Help } from '@/components/Help';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextField } from '@/components/form/TextField';

const TASK_TYPE = 'propose-metric-binding';

/**
 * A amarração: qual métrica da fonte responde por este experimento.
 *
 * O agente propõe, o fundador confirma — sempre. A amarração é proveniência, e
 * proveniência não se infere: uma amarração errada não erra um formulário, erra
 * todos os números daquele experimento para sempre, e o erro chega disfarçado
 * de dado (spec §6).
 */
export function MetricBindingCard({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [saveError, setSaveError] = useState<string | null>(null);

  const binding = useGetMetricBinding(experimentId, { query: { retry: false } });
  const integrations = useListIntegrations();
  const credits = useGetCredits();
  const pricing = useGetCreditPricing();

  const connected = integrations.data?.integrations.some((row) => row.provider === 'GA4') ?? false;
  const cost = pricing.data?.operations.find((operation) => operation.taskType === TASK_TYPE)?.credits ?? null;
  const balance = credits.data ? availableCredits(credits.data) : null;
  // Orientação, não autorização: enquanto preço ou saldo não resolveram, não
  // bloqueia quem tem saldo.
  const short = cost !== null && balance !== null && balance < cost;

  const current = binding.data?.binding ?? null;
  const config = proposeMetricBindingOutput.shape.binding.safeParse(current?.config ?? null);
  const bound = config.success ? config.data : null;

  const { control, handleSubmit, setValue } = useForm<MetricBindingFormValues>({
    resolver: zodResolver(metricBindingFormSchema),
    defaultValues: { metric: '', filterField: '', filterValue: '' },
  });

  const run = useFillRun({
    taskType: TASK_TYPE,
    input: { experimentId },
    // Um run adotado tem que ser deste experimento: o mais recente do workspace
    // pode ser de outro, e aplicá-lo amarraria a métrica errada.
    matchesInput: (input) => parseRunExperimentId(input) === experimentId,
    startFailedMessage: t('ai.fill.startFailed'),
  });

  const proposal = run.state === 'done' ? proposeMetricBindingOutput.safeParse(run.output) : null;
  // Guardado pelo id do run: sem isto, cada render sobrescreveria o que o
  // fundador editou depois de a proposta chegar.
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!proposal?.success || !run.runId || applied.current === run.runId) return;
    applied.current = run.runId;
    // `binding: null` não preenche nada. A tela mostra o motivo e para aí.
    const proposed = proposal.data.binding;
    if (!proposed) return;
    setValue('metric', proposed.metric);
    setValue('filterField', proposed.dimensionFilter?.fieldName ?? '');
    setValue('filterValue', proposed.dimensionFilter?.value ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.runId, proposal?.success]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getMetricBindingQueryKey(experimentId) });

  const save = usePutMetricBinding({
    mutation: {
      onMutate: () => setSaveError(null),
      onSuccess: async () => await invalidate(),
      onError: (error) => setSaveError(apiErrorMessage(error, t('pages.experiments.binding.saveFailed'))),
    },
  });

  const remove = useRemoveMetricBinding({
    mutation: {
      onMutate: () => setSaveError(null),
      onSuccess: async () => await invalidate(),
      onError: (error) => setSaveError(apiErrorMessage(error, t('pages.experiments.binding.saveFailed'))),
    },
  });

  const onSubmit = handleSubmit((values) => {
    save.mutate({
      id: experimentId,
      data: {
        provider: 'GA4',
        config: {
          metric: values.metric,
          dimensionFilter:
            values.filterField && values.filterValue
              ? { fieldName: values.filterField, value: values.filterValue }
              : null,
        },
      },
    });
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm font-medium">
          {t('pages.experiments.binding.title')}
          <Help title={t('pages.experiments.binding.helpTitle')}>{t('pages.experiments.binding.help')}</Help>
        </p>

        {bound && (
          <div className="space-y-2 border-l-2 border-primary/40 pl-3">
            <p className="text-sm">
              {t('pages.experiments.binding.bound')} <span className="font-mono">{bound.metric}</span>
            </p>
            {bound.dimensionFilter && (
              <p className="text-sm text-muted-foreground">
                {t('pages.experiments.binding.filteredBy')}{' '}
                <span className="font-mono">
                  {bound.dimensionFilter.fieldName} = {bound.dimensionFilter.value}
                </span>
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ id: experimentId })}
            >
              {t('pages.experiments.binding.remove')}
            </Button>
          </div>
        )}

        {/* O bloco de IA. Sem fonte conectada não há o que propor, e o botão
            cinza sem explicação é a versão de UI de um erro sem mensagem. */}
        {!connected ? (
          <p className="text-sm text-muted-foreground">
            {t('pages.experiments.binding.notConnected')}{' '}
            <Link to="/app/settings/integrations" className="underline">
              {t('pages.experiments.binding.connectLink')}
            </Link>
          </p>
        ) : run.state === 'starting' ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t('ai.fill.thinking')}
          </p>
        ) : run.state === 'running' ? (
          <RunningRunCard
            startedAt={run.startedAt}
            isForeign={run.isForeign}
            onCancel={run.cancel}
            isCancelling={run.isCancelling}
          />
        ) : (
          <div className="space-y-2">
            <SpecialistByline specialist="analyst" />
            {run.error && <p className="text-sm text-destructive">{run.error}</p>}
            <Button size="sm" className="gap-2" disabled={short || run.isStarting} onClick={run.start}>
              <Sparkles className="size-4" /> {t('pages.experiments.binding.aiLabel')}
            </Button>
            {cost !== null && <p className="text-xs text-muted-foreground">{t('ai.fill.cost', { credits: cost })}</p>}
            {short && <p className="text-sm text-destructive">{t('ai.fill.short')}</p>}
          </div>
        )}

        {proposal?.success && (
          <div className="space-y-1 rounded-md border p-3">
            {/* Nenhuma métrica plausível: o motivo, e nada preenchido. */}
            {!proposal.data.binding && (
              <p className="text-sm font-medium">{t('pages.experiments.binding.aiNothingFits')}</p>
            )}
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('pages.experiments.binding.aiRationale')}
            </p>
            <p className="text-sm text-muted-foreground">{proposal.data.rationale}</p>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4 border-t pt-4">
          <Controller
            control={control}
            name="metric"
            render={({ field, fieldState }) => (
              <TextField
                htmlFor="binding-metric"
                label={t('pages.experiments.binding.metricLabel')}
                helpTitle={t('pages.experiments.binding.metricHelpTitle')}
                help={t('pages.experiments.binding.metricHelp')}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              />
            )}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="filterField"
              render={({ field, fieldState }) => (
                <TextField
                  htmlFor="binding-filter-field"
                  label={t('pages.experiments.binding.filterFieldLabel')}
                  helpTitle={t('pages.experiments.binding.filterHelpTitle')}
                  help={t('pages.experiments.binding.filterHelp')}
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
              name="filterValue"
              render={({ field, fieldState }) => (
                <TextField
                  htmlFor="binding-filter-value"
                  label={t('pages.experiments.binding.filterValueLabel')}
                  optional
                  optionalLabel={t('common.optional')}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                />
              )}
            />
          </div>

          {saveError && <p className="text-sm text-destructive">{saveError}</p>}

          <Button type="submit" size="sm" disabled={save.isPending}>
            {save.isPending ? t('common.saving') : t('pages.experiments.binding.save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
