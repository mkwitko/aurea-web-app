import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useGetMetricBinding } from '@/api/generated/hooks/experimentsHooks/useGetMetricBinding';
import { useGetMeasurementProposal } from '@/api/generated/hooks/experimentsHooks/useGetMeasurementProposal';
import { useCreateOutcome } from '@/api/generated/hooks/outcomesHooks/useCreateOutcome';
import { listOutcomesQueryKey } from '@/api/generated/hooks/outcomesHooks/useListOutcomes';
import { getExperimentQueryKey } from '@/api/generated/hooks/experimentsHooks/useGetExperiment';
import { apiErrorMessage } from '@/lib/api-errors';
import { Help } from '@/components/Help';
import { SectionLoading } from '@/components/SectionState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** Os códigos que a rota devolve para cada recusa de setup (back: catalog.ts). */
const NO_BINDING = 'pages.experiments.measurement.noBinding';
const REFUSALS: Record<string, string> = {
  'AUR-T0036': NO_BINDING,
  'AUR-T0037': 'pages.experiments.measurement.noSource',
  'AUR-T0038': 'pages.experiments.measurement.noPeriod',
};

function errorCode(error: unknown): string | null {
  const code = (error as { data?: { error?: { code?: unknown } } } | null | undefined)?.data?.error?.code;
  return typeof code === 'string' ? code : null;
}

function refusalKey(error: unknown): string | null {
  const code = errorCode(error);
  return code === null ? null : (REFUSALS[code] ?? null);
}

/**
 * A rota da amarração responde 404 quando não existe amarração — e só isso é
 * "ainda não amarrado". Qualquer outra falha (500, rede) tratada como ausência
 * diria ao fundador para amarrar de novo algo que já está amarrado.
 */
function bindingMissing(error: unknown): boolean {
  return errorCode(error) === 'AUR-T0005';
}

/**
 * A leitura da fonte, mostrada antes de virar fato.
 *
 * Nada aqui grava sozinho: a proposta é transitória e confirmar é o mesmo
 * `POST /experiments/:id/outcomes` de sempre, agora com `fromSource: true` —
 * que faz o servidor **refazer** a leitura em vez de aceitar o número desta
 * tela. Confirmar é concordar com a leitura, não transportá-la (spec §8).
 */
export function MeasurementProposalCard({
  experimentId,
  canMeasure,
  onInterpretationStarted,
}: {
  experimentId: string;
  /** O experimento terminou e ainda não tem número. Falso: nada é buscado. */
  canMeasure: boolean;
  onInterpretationStarted?: (agentRunId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // A amarração é a porta: sem ela a proposta só poderia falhar, e uma
  // requisição que só pode falhar é ruído no lugar de orientação (spec §9).
  const binding = useGetMetricBinding(experimentId, { query: { retry: false } });
  const bound = binding.data?.binding != null;

  const proposal = useGetMeasurementProposal(experimentId, {
    query: { enabled: canMeasure && bound, retry: false },
  });

  const confirm = useCreateOutcome({
    mutation: {
      onMutate: () => setConfirmError(null),
      onSuccess: async (data) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: listOutcomesQueryKey(experimentId) }),
          queryClient.invalidateQueries({ queryKey: getExperimentQueryKey(experimentId) }),
        ]);
        if (data.interpretation.agentRunId) onInterpretationStarted?.(data.interpretation.agentRunId);
      },
      onError: (error) => setConfirmError(apiErrorMessage(error, t('pages.experiments.measurement.failed'))),
    },
  });

  const formatDate = (value: Date | string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value));

  // A constante, e não `REFUSALS['AUR-T0036']`: com `noUncheckedIndexedAccess`
  // o acesso indexado devolve `string | undefined`, e `t(undefined)` não compila.
  const refusal = refusalKey(proposal.error) ?? (bindingMissing(binding.error) ? NO_BINDING : null);
  // A amarração falhou por outro motivo: é falha de leitura, não ausência de
  // amarração, e o retry é sobre ela.
  const bindingBroken = binding.isError && !bindingMissing(binding.error);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm font-medium">
          {t('pages.experiments.measurement.title')}
          <Help title={t('pages.experiments.measurement.helpTitle')}>{t('pages.experiments.measurement.help')}</Help>
        </p>

        {!canMeasure && <p className="text-sm text-muted-foreground">{t('pages.experiments.measurement.notReady')}</p>}

        {canMeasure && refusal && <p className="text-sm text-muted-foreground">{t(refusal)}</p>}

        {canMeasure && !refusal && !bindingBroken && (proposal.isLoading || binding.isLoading) && <SectionLoading />}

        {canMeasure && bindingBroken && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              {apiErrorMessage(binding.error, t('pages.experiments.measurement.failed'))}
            </p>
            <Button size="sm" variant="outline" onClick={() => void binding.refetch()}>
              {t('pages.experiments.measurement.retry')}
            </Button>
          </div>
        )}

        {/* Falha de leitura: a mensagem da própria fonte, e um retry. Distinta
            de zero — "não deu para ler" e "a fonte respondeu zero" não são a
            mesma notícia. */}
        {canMeasure && !refusal && proposal.isError && (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              {apiErrorMessage(proposal.error, t('pages.experiments.measurement.failed'))}
            </p>
            <Button size="sm" variant="outline" onClick={() => void proposal.refetch()}>
              {t('pages.experiments.measurement.retry')}
            </Button>
          </div>
        )}

        {canMeasure && proposal.data && (
          <div className="space-y-3">
            <p className="font-display text-3xl font-extrabold">
              {proposal.data.value}
              {proposal.data.unit ? ` ${proposal.data.unit}` : ''}
            </p>
            {proposal.data.value === 0 && (
              <p className="text-sm text-muted-foreground">{t('pages.experiments.measurement.zero')}</p>
            )}
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                {t('pages.experiments.measurement.period')}: {formatDate(proposal.data.periodStart)} →{' '}
                {formatDate(proposal.data.periodEnd)}
              </p>
              <p className="flex items-center gap-2">
                {t('pages.experiments.measurement.source')}: <Badge variant="muted">{proposal.data.source}</Badge>
              </p>
              <p className="font-mono text-xs">
                {t('pages.experiments.measurement.reference')}: {proposal.data.externalRef}
              </p>
            </div>

            {confirmError && <p className="text-sm text-destructive">{confirmError}</p>}

            <Button
              size="sm"
              disabled={confirm.isPending}
              // Sem `value` no corpo: o servidor refaz a leitura. Mandar o
              // número daqui seria um número sem origem com selo de origem.
              onClick={() => confirm.mutate({ id: experimentId, data: { fromSource: true } })}
            >
              {confirm.isPending
                ? t('pages.experiments.measurement.confirming')
                : t('pages.experiments.measurement.confirm')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('pages.experiments.measurement.orManual')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
