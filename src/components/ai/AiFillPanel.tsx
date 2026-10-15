import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CurrencyField } from '@/components/form/CurrencyField';
import { NumberField } from '@/components/form/NumberField';
import { SelectField } from '@/components/form/SelectField';
import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { sortByImpact, type FillQuestion } from '@/schemas/fill-proposal';

export interface AiFillPanelProps {
  questions: readonly FillQuestion[];
  /** Writes one answer into the form. The path is a `fills` value. */
  onAnswer(path: string, value: string | number): void;
  /** Fires when the last question is resolved, however it was resolved. */
  onDone?(): void;
}

const NUMERIC = ['number', 'currency', 'percent', 'count'];

/**
 * Uma pergunta por vez, na ordem de impacto.
 *
 * O painel nunca edita o que já foi preenchido — ele só pergunta. Quem sabe o
 * que é CAC digita direto no formulário e ignora esta coluna; quem não sabe
 * responde "quantos clientes cancelam por mês" e o formulário se preenche.
 *
 * Duas saídas, e a diferença entre elas importa: "não sei" resolve a pergunta
 * para sempre neste run, "pular" manda para o fim da fila. Nenhuma das duas
 * bloqueia o Salvar — salvar parcial é legítimo e o PUT já aceita seção
 * incompleta.
 */
export function AiFillPanel({ questions, onAnswer, onDone }: AiFillPanelProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<string[]>([]);
  const [draft, setDraft] = useState<string | number | undefined>(undefined);

  const pending = sortByImpact(questions).filter((question) => !resolved.has(question.id));
  // Puladas vão para o fim, na ordem em que foram puladas.
  const queue = [
    ...pending.filter((question) => !skipped.includes(question.id)),
    ...skipped
      .map((id) => pending.find((question) => question.id === id))
      .filter((question): question is FillQuestion => question !== undefined),
  ];
  const current = queue[0];

  // Num efeito, e não no render: chamar onDone durante o render mudaria estado
  // do pai no meio do render dele.
  useEffect(() => {
    if (questions.length > 0 && queue.length === 0) onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, questions.length]);

  if (!current) return null;

  const resolve = (id: string) => {
    setResolved((previous) => new Set(previous).add(id));
    setSkipped((previous) => previous.filter((skippedId) => skippedId !== id));
    setDraft(undefined);
  };

  const submit = () => {
    if (draft === undefined || draft === '') return;
    onAnswer(current.fills, draft);
    resolve(current.id);
  };

  const skip = () => {
    setSkipped((previous) => [...previous.filter((id) => id !== current.id), current.id]);
    setDraft(undefined);
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="space-y-3 p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('ai.fill.panelTitle')}</p>
        <p className="text-base leading-snug">{current.ask}</p>
        <p className="text-sm text-muted-foreground">{current.why}</p>

        {current.answerType === 'choice' ? (
          <SelectField
            htmlFor={inputId}
            label={t('ai.fill.answer')}
            value={typeof draft === 'string' ? draft : undefined}
            onChange={(value) => setDraft(value ?? undefined)}
            options={(current.choices ?? []).map((choice) => ({ value: choice, labelKey: choice }))}
            translate={(label) => label}
          />
        ) : current.answerType === 'currency' ? (
          // Mesma máscara de milhar do formulário: responder "300000" aqui e
          // ver o campo do formulário virar "300.000" é a mesma pergunta feita
          // duas vezes de forma diferente.
          <CurrencyField
            htmlFor={inputId}
            label={t('ai.fill.answer')}
            value={typeof draft === 'number' ? draft : undefined}
            onChange={(value) => setDraft(value)}
            placeholder={t('ai.fill.answerPlaceholder')}
          />
        ) : NUMERIC.includes(current.answerType) ? (
          <NumberField
            htmlFor={inputId}
            label={t('ai.fill.answer')}
            step="any"
            value={typeof draft === 'number' ? draft : undefined}
            onChange={(value) => setDraft(value)}
            placeholder={t('ai.fill.answerPlaceholder')}
          />
        ) : (
          <TextField
            htmlFor={inputId}
            label={t('ai.fill.answer')}
            value={typeof draft === 'string' ? draft : undefined}
            onChange={(value) => setDraft(value)}
            placeholder={t('ai.fill.answerPlaceholder')}
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={submit}>
            {t('ai.fill.answer')}
          </Button>
          <Button size="sm" variant="link" className="px-0" onClick={() => resolve(current.id)}>
            {t('ai.fill.dontKnow')}
          </Button>
          {queue.length > 1 && (
            <Button size="sm" variant="link" className="px-0" onClick={skip}>
              {t('ai.fill.skip')}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {t('ai.fill.progress', { current: resolved.size, total: questions.length })}
        </p>
      </CardContent>
    </Card>
  );
}
