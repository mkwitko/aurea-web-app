import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useListOutcomes, listOutcomesQueryKey } from '@/api/generated/hooks/outcomesHooks/useListOutcomes';
import { useCreateOutcome } from '@/api/generated/hooks/outcomesHooks/useCreateOutcome';
import { getExperimentQueryKey } from '@/api/generated/hooks/experimentsHooks/useGetExperiment';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { useGetCreditPricing } from '@/api/generated/hooks/creditsHooks/useGetCreditPricing';
import { availableCredits } from '@/lib/credits';
import { apiErrorMessage } from '@/lib/api-errors';
import { outcomeFormSchema, type OutcomeFormValues } from '@/schemas/outcomes';
import { Help } from '@/components/Help';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextField } from '@/components/form/TextField';
import { NumberField } from '@/components/form/NumberField';

/**
 * What the experiment actually measured, and the form that records it.
 *
 * Deliberately verdict-free. `successCriteria` is free text, so no honest
 * "successful" can be computed from it, and inferring one from completion is
 * what `docs/domains/experiments.md` §14 forbids ("Completed ≠ Successful").
 * The section shows the number against the target and stops there — the
 * judgement is the learning, and a human writes that.
 */
export function OutcomesSection({
  experimentId,
  metric,
  targetValue,
  onInterpretationStarted,
}: {
  experimentId: string;
  metric: string;
  targetValue: number | null;
  /**
   * Gravar o número enfileira a leitura no servidor. O run volta na resposta e
   * sobe para a página, que o entrega ao painel de interpretação — sem isso o
   * painel ofereceria rodar uma leitura que já está na fila.
   */
  onInterpretationStarted?: (agentRunId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [recordError, setRecordError] = useState<string | null>(null);

  const outcomes = useListOutcomes(experimentId);
  const credits = useGetCredits();
  const pricing = useGetCreditPricing();
  const [interpretationSkipped, setInterpretationSkipped] = useState<string | null>(null);

  const costPerRun =
    pricing.data?.operations.find((operation) => operation.taskType === 'interpret-outcome')?.credits ?? null;
  const balance = credits.data ? availableCredits(credits.data) : null;
  // Enquanto os números não resolvem, `short` fica falso para não bloquear quem
  // tem saldo.
  const short = costPerRun !== null && balance !== null && balance < costPerRun;

  const { control, handleSubmit, reset } = useForm<OutcomeFormValues>({
    resolver: zodResolver(outcomeFormSchema),
    defaultValues: { value: undefined, unit: '', observedAt: '' },
  });

  const record = useCreateOutcome({
    mutation: {
      onMutate: () => setRecordError(null),
      onSuccess: async (data) => {
        reset();
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: listOutcomesQueryKey(experimentId) }),
          // The experiment itself is re-read too: recording a measurement is
          // what makes the page's next-step prompt change.
          queryClient.invalidateQueries({ queryKey: getExperimentQueryKey(experimentId) }),
        ]);
        // O número está gravado nos dois casos. Com run, a leitura já está na
        // fila e a página adota; sem run, o motivo aparece e o painel de
        // interpretação continua oferecendo o retry que já existe.
        if (data.interpretation.agentRunId) {
          setInterpretationSkipped(null);
          onInterpretationStarted?.(data.interpretation.agentRunId);
        } else {
          setInterpretationSkipped(data.interpretation.reason ?? t('pages.experiments.outcomes.interpretSkipped'));
        }
      },
      // Whatever was typed stays on screen: a refusal is a reason to correct
      // one field, not to retype a number that was right.
      onError: (error) => setRecordError(apiErrorMessage(error, t('pages.experiments.outcomes.recordFailed'))),
    },
  });

  const onSubmit = handleSubmit((values) => {
    record.mutate({
      id: experimentId,
      data: {
        value: values.value,
        unit: values.unit || undefined,
        observedAt: values.observedAt ? new Date(values.observedAt) : undefined,
      },
    });
  });

  const formatDate = (value: Date | string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value));

  // A movement is only readable with its sign: "1.9" and "-1.9" are opposite
  // news about the same experiment.
  const formatSigned = (value: number) =>
    new Intl.NumberFormat(i18n.language, { signDisplay: 'exceptZero', maximumFractionDigits: 1 }).format(value);
  const formatPlain = (value: number) =>
    new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(value);

  /**
   * The two numbers agreed beforehand, applied to the one that came in.
   *
   * Still no verdict: movement and share-of-target are arithmetic
   * (`docs/domains/analytics.md` §22), and naming a winner from them is what
   * §14 of experiments.md forbids.
   */
  const comparisonParts = (
    // Optional even though the server always sends it: a response cached before
    // this field existed must render a measurement, not crash the section.
    comparison?: { delta: number | null; deltaPct: number | null; progressPct: number | null },
  ) => {
    if (!comparison) return [];
    const parts: string[] = [];

    if (comparison.delta !== null) {
      // A baseline of zero has no usable ratio, so that phrasing drops the
      // percentage instead of printing an em dash inside a sentence.
      parts.push(
        comparison.deltaPct !== null
          ? t('pages.experiments.outcomes.movement', {
              delta: formatSigned(comparison.delta),
              pct: formatSigned(comparison.deltaPct),
            })
          : t('pages.experiments.outcomes.movementNoPct', { delta: formatSigned(comparison.delta) }),
      );
    }
    if (comparison.progressPct !== null) {
      parts.push(t('pages.experiments.outcomes.ofTarget', { pct: formatPlain(comparison.progressPct) }));
    }
    return parts;
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm font-medium">
          {t('pages.experiments.outcomes.title')}
          <Help title={t('pages.experiments.outcomes.helpTitle')}>{t('pages.experiments.outcomes.help')}</Help>
        </p>

        {outcomes.isLoading && <SectionLoading />}
        {(outcomes.isError || (!outcomes.isLoading && !outcomes.data)) && (
          <SectionLoadError refetch={[outcomes.refetch]} />
        )}

        {outcomes.data &&
          (outcomes.data.outcomes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('pages.experiments.outcomes.empty')}</p>
          ) : (
            <ul className="space-y-3">
              {outcomes.data.outcomes.map((outcome) => (
                <li key={outcome.id} className="border-l-2 border-primary/40 pl-3">
                  <p className="font-display text-2xl font-extrabold">
                    {outcome.value}
                    {outcome.unit ? ` ${outcome.unit}` : ''}
                  </p>
                  {targetValue !== null && (
                    <p className="text-sm text-muted-foreground">
                      {t('pages.experiments.outcomes.againstTarget', { target: targetValue })}
                    </p>
                  )}
                  {comparisonParts(outcome.comparison).length > 0 && (
                    <p className="text-sm font-medium">{comparisonParts(outcome.comparison).join(' · ')}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDate(outcome.observedAt)} ·{' '}
                    {t(`pages.experiments.outcomes.source.${outcome.source}`, { defaultValue: outcome.source })}
                  </p>
                </li>
              ))}
            </ul>
          ))}

        <form onSubmit={onSubmit} className="space-y-4 border-t pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="value"
              render={({ field, fieldState }) => (
                <NumberField
                  htmlFor="outcome-value"
                  label={t('pages.experiments.outcomes.valueLabel')}
                  step="any"
                  // The experiment's own metric, so it is clear what the number
                  // is a number of without repeating it on every row.
                  placeholder={metric}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                />
              )}
            />
            <Controller
              control={control}
              name="unit"
              render={({ field, fieldState }) => (
                <TextField
                  htmlFor="outcome-unit"
                  label={t('pages.experiments.outcomes.unitLabel')}
                  optional
                  optionalLabel={t('common.optional')}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                />
              )}
            />
          </div>

          <Controller
            control={control}
            name="observedAt"
            render={({ field, fieldState }) => (
              <TextField
                htmlFor="outcome-observed-at"
                label={t('pages.experiments.outcomes.observedAtLabel')}
                helpTitle={t('pages.experiments.outcomes.observedAtHelpTitle')}
                help={t('pages.experiments.outcomes.observedAtHelp')}
                type="date"
                optional
                optionalLabel={t('common.optional')}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              />
            )}
          />

          {recordError && <p className="text-sm text-destructive">{recordError}</p>}

          {interpretationSkipped && (
            <p className="text-sm text-muted-foreground">
              {t('pages.experiments.outcomes.recordedWithoutInterpretation', { reason: interpretationSkipped })}
            </p>
          )}

          {/* Saldo curto NÃO desabilita: a medição é fato observado, e perder o
              número por falta de crédito seria perder exatamente o que o loop
              existe para registrar. O servidor grava o outcome e devolve
              `{ agentRunId: null, reason }` — o aviso abaixo diz que a leitura
              fica para depois, e o painel de interpretação guarda o retry. */}
          <Button type="submit" size="sm" disabled={record.isPending}>
            {record.isPending ? t('common.saving') : t('pages.experiments.outcomes.recordAndInterpret')}
          </Button>

          {costPerRun !== null && (
            <p className="text-xs text-muted-foreground">
              {/* Cost and balance are separate elements, not sibling text nodes
                  in the same paragraph: RTL's `getByText` matches an element's
                  own direct text-node children only, so combining them into one
                  text node would make an exact match on the cost alone
                  unfindable once a balance is also on screen. */}
              <span>{t('pages.experiments.outcomes.cost', { credits: costPerRun })}</span>
              {balance !== null && <span> · {t('pages.experiments.outcomes.balance', { credits: balance })}</span>}
            </p>
          )}

          {short && <p className="text-sm text-destructive">{t('pages.experiments.outcomes.short')}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
