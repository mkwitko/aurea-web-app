import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { GetProposalDraft200 } from '@/api/generated/types/GetProposalDraft';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextField } from '@/components/form/TextField';
import { TextAreaField } from '@/components/form/TextAreaField';
import { TagsField } from '@/components/form/TagsField';
import { SelectField } from '@/components/form/SelectField';
import { Repeater } from '@/components/form/Repeater';

/** O plano combinado, na forma que o servidor monta e o aceite grava. */
export type StrategyDraft = GetProposalDraft200['strategy'];
type Hypothesis = StrategyDraft['hypotheses'][number];

interface StrategyPlanEditorProps {
  /** Semente vinda do servidor — a fusão das opções escolhidas. */
  draft: StrategyDraft;
  /** Nomes das opções que entraram, para o fundador ver o que está combinando. */
  combining: string[];
  saving: boolean;
  error: string | null;
  onSubmit: (draft: StrategyDraft) => void;
  onBack: () => void;
}

// Os mesmos limites das colunas (create-from-proposal.schema.ts no backend).
// Aplicados como `maxLength` nos campos em vez de validação depois: o fundador
// não deve conseguir escrever um texto que o servidor vai recusar — e uma
// recusa depois de tudo digitado é o pior momento para descobrir o limite.
const LIMITS = {
  name: 200,
  strategicThesis: 2000,
  growthMechanism: 160,
  expectedOutcome: 1000,
  statement: 500,
  rationale: 1000,
  targetMetric: 160,
} as const;

// Quantos itens cada lista aceita — os mesmos tetos do servidor, dimensionados
// para uma combinação de três opções inteiras. Adicionar de mais aqui só é
// possível à mão, e sem este aviso a recusa chegaria depois de tudo escrito.
const MAX_ITEMS = { channels: 18, assumptions: 15, risks: 15, hypotheses: 9 } as const;

const CONFIDENCE: Hypothesis['confidence'][] = ['LOW', 'MEDIUM', 'HIGH'];

const emptyHypothesis = (): Hypothesis => ({
  statement: '',
  rationale: '',
  targetMetric: '',
  expectedOutcome: '',
  confidence: 'MEDIUM',
});

/**
 * O plano antes de existir, aberto para edição.
 *
 * A proposta da AUREA é um rascunho, não um decreto: o fundador conhece o
 * negócio e a tela tinha um único botão "usar este", que obrigava a aceitar o
 * texto do modelo palavra por palavra ou reescrever tudo à mão depois, num
 * registro que já dizia ter vindo da IA.
 *
 * A semente vem do servidor (`GET .../draft`), então a fusão de duas ou três
 * opções tem uma implementação só — a mesma que grava.
 */
export function StrategyPlanEditor({ draft, combining, saving, error, onSubmit, onBack }: StrategyPlanEditorProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<StrategyDraft>(draft);

  const patch = (changes: Partial<StrategyDraft>) => setForm((current) => ({ ...current, ...changes }));

  // O servidor exige cada um destes: um plano sem tese, sem canal ou sem
  // hipótese não é um plano. Barrado aqui para que a recusa não custe um
  // round trip com o formulário inteiro preenchido.
  const tooLong =
    form.channels.length > MAX_ITEMS.channels ||
    form.assumptions.length > MAX_ITEMS.assumptions ||
    form.risks.length > MAX_ITEMS.risks ||
    form.hypotheses.length > MAX_ITEMS.hypotheses;

  const complete =
    form.name.trim().length > 0 &&
    form.strategicThesis.trim().length > 0 &&
    form.growthMechanism.trim().length > 0 &&
    form.expectedOutcome.trim().length > 0 &&
    form.channels.length > 0 &&
    form.assumptions.length > 0 &&
    form.risks.length > 0 &&
    form.hypotheses.length > 0 &&
    form.hypotheses.every(
      (hypothesis) =>
        hypothesis.statement.trim().length > 0 &&
        hypothesis.rationale.trim().length > 0 &&
        hypothesis.targetMetric.trim().length > 0 &&
        hypothesis.expectedOutcome.trim().length > 0,
    );

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('pages.strategies.propose.editorTitle')}</p>
          <p className="text-xs text-muted-foreground">
            {t('pages.strategies.propose.combining', { names: combining.join(' + ') })}
          </p>
        </div>

        <TextField
          htmlFor="plan-name"
          label={t('pages.strategies.propose.nameLabel')}
          value={form.name}
          onChange={(value) => patch({ name: value })}
          maxLength={LIMITS.name}
        />

        <TextField
          htmlFor="plan-mechanism"
          label={t('pages.strategies.propose.mechanismLabel')}
          help={t('pages.strategies.propose.mechanismHelp')}
          helpTitle={t('pages.strategies.propose.mechanismLabel')}
          value={form.growthMechanism}
          onChange={(value) => patch({ growthMechanism: value })}
          maxLength={LIMITS.growthMechanism}
        />

        <TextAreaField
          htmlFor="plan-thesis"
          label={t('pages.strategies.propose.thesisLabel')}
          value={form.strategicThesis}
          onChange={(value) => patch({ strategicThesis: value })}
          rows={6}
          maxLength={LIMITS.strategicThesis}
        />

        <TextAreaField
          htmlFor="plan-outcome"
          label={t('pages.strategies.propose.outcomeLabel')}
          value={form.expectedOutcome}
          onChange={(value) => patch({ expectedOutcome: value })}
          rows={3}
          maxLength={LIMITS.expectedOutcome}
        />

        <TagsField
          htmlFor="plan-channels"
          label={t('pages.strategies.propose.channelsLabel')}
          value={form.channels}
          onChange={(channels) => patch({ channels })}
          addLabel={t('pages.strategies.propose.addChannel')}
          removeLabel={(tag) => t('pages.strategies.propose.removeItem', { item: tag })}
        />

        <TagsField
          htmlFor="plan-assumptions"
          label={t('pages.strategies.propose.assumptionsLabel')}
          value={form.assumptions}
          onChange={(assumptions) => patch({ assumptions })}
          addLabel={t('pages.strategies.propose.addAssumption')}
          removeLabel={(tag) => t('pages.strategies.propose.removeItem', { item: tag })}
        />

        <TagsField
          htmlFor="plan-risks"
          label={t('pages.strategies.propose.risksLabel')}
          value={form.risks}
          onChange={(risks) => patch({ risks })}
          addLabel={t('pages.strategies.propose.addRisk')}
          removeLabel={(tag) => t('pages.strategies.propose.removeItem', { item: tag })}
        />

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('pages.strategies.propose.hypothesesLabel')}</p>
          {/* Editáveis, e não só visíveis: uma hipótese é o que vai ser testado,
              e um plano combinado chega aqui com as hipóteses das duas opções —
              é justamente onde sobra o que o fundador não quer testar. */}
          <Repeater
            items={form.hypotheses}
            onChange={(hypotheses) => patch({ hypotheses })}
            newItem={emptyHypothesis}
            itemLabel={(index) => t('pages.strategies.propose.hypothesisLabel', { position: index + 1 })}
            addLabel={t('pages.strategies.propose.addHypothesis')}
            removeLabel={t('pages.strategies.propose.removeHypothesis')}
            renderItem={(hypothesis, update, index) => (
              <div className="space-y-3">
                <TextAreaField
                  htmlFor={`hypothesis-statement-${index}`}
                  label={t('pages.strategies.propose.hypothesisStatement')}
                  value={hypothesis.statement}
                  onChange={(statement) => update({ statement })}
                  rows={2}
                  maxLength={LIMITS.statement}
                />
                <TextAreaField
                  htmlFor={`hypothesis-rationale-${index}`}
                  label={t('pages.strategies.propose.hypothesisRationale')}
                  value={hypothesis.rationale}
                  onChange={(rationale) => update({ rationale })}
                  rows={2}
                  maxLength={LIMITS.rationale}
                />
                <TextField
                  htmlFor={`hypothesis-metric-${index}`}
                  label={t('pages.strategies.propose.hypothesisMetric')}
                  value={hypothesis.targetMetric}
                  onChange={(targetMetric) => update({ targetMetric })}
                  maxLength={LIMITS.targetMetric}
                />
                <TextAreaField
                  htmlFor={`hypothesis-outcome-${index}`}
                  label={t('pages.strategies.propose.hypothesisOutcome')}
                  value={hypothesis.expectedOutcome}
                  onChange={(expectedOutcome) => update({ expectedOutcome })}
                  rows={2}
                  maxLength={LIMITS.expectedOutcome}
                />
                <SelectField
                  htmlFor={`hypothesis-confidence-${index}`}
                  label={t('pages.strategies.propose.hypothesisConfidence')}
                  value={hypothesis.confidence}
                  onChange={(value) => update({ confidence: (value as Hypothesis['confidence']) ?? 'MEDIUM' })}
                  options={CONFIDENCE.map((level) => ({
                    value: level,
                    labelKey: `pages.research.confidence.${level}`,
                  }))}
                  translate={(key) => t(key)}
                />
              </div>
            )}
          />
        </div>

        {tooLong && <p className="text-sm text-destructive">{t('pages.strategies.propose.tooManyItems', MAX_ITEMS)}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={saving || !complete || tooLong} onClick={() => onSubmit(form)}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t('pages.strategies.propose.createBtn')}
          </Button>
          <Button size="sm" variant="outline" disabled={saving} onClick={onBack}>
            {t('pages.strategies.propose.backBtn')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
