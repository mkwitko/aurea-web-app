import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles } from 'lucide-react';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { useGetCreditPricing } from '@/api/generated/hooks/creditsHooks/useGetCreditPricing';
import { availableCredits } from '@/lib/credits';
import { parseFillProposal, type FillQuestion } from '@/schemas/fill-proposal';
import { fillErrorKind } from '@/lib/fill-error';
import { Button } from '@/components/ui/button';
import { AiFillPanel } from './AiFillPanel';
import { FillErrorCard } from './FillErrorCard';
import { SpecialistByline, specialistFor } from './SpecialistByline';
import { RunningRunCard } from './RunningRunCard';
import { useFillRun } from './useFillRun';

export interface AiFillButtonProps {
  taskType: string;
  input: Record<string, unknown> | null;
  allowedPaths: readonly string[];
  /** Rendered instead of the button when a prerequisite is missing. */
  blockedReason?: { message: string; to?: string; linkLabel?: string } | null;
  label: string;
  /**
   * Applies everything the model filled. Receives the raw `filled` value.
   *
   * `adopted` says the proposal was recovered on mount rather than produced by
   * a click here — it fires again on every mount for as long as that run stays
   * the latest one. Writing into the form is idempotent and wants it either
   * way; a one-shot side effect (navigating) must skip the adopted case.
   */
  onFilled(filled: unknown, runId: string, adopted: boolean): void;
  /** Writes one answer into the form. `runId` is the run that asked it — see the note on `onFilled` above. */
  onAnswer(path: string, value: string | number, runId: string): void;
  matchesInput?: (input: unknown) => boolean;
  /**
   * Narrows which questions the panel shows, without touching what the run is
   * allowed to have asked. A proposal that spans several screens (the
   * whole-context run, adopted on each of its seven section pages) still
   * carries every question it asked in one array; a screen that can only
   * apply one section's worth of answers must not offer questions it cannot
   * save. `allowedPaths` is the wrong lever for this — it feeds
   * `parseFillProposal`, which REFUSES the whole result the moment one
   * question's `fills` falls outside it, so narrowing it to "just this
   * screen" would make a legitimate cross-section proposal unreadable
   * instead of merely trimming what's shown.
   */
  filterQuestions?: (question: FillQuestion) => boolean;
}

/**
 * "Gerar com IA", em todas as sete telas.
 *
 * O botão desabilitado nunca aparece sozinho: quando falta um pré-requisito,
 * `blockedReason` diz o que falta e para onde ir. Um botão cinza sem
 * explicação é a versão de UI de um erro sem mensagem.
 *
 * O cálculo do pré-requisito é do chamador, a partir do que já está na tela —
 * nenhuma requisição a mais. O `precheck` do servidor é a rede de segurança,
 * não a fonte deste estado.
 */
export function AiFillButton({
  taskType,
  input,
  allowedPaths,
  blockedReason,
  label,
  onFilled,
  onAnswer,
  matchesInput,
  filterQuestions,
}: AiFillButtonProps) {
  const { t } = useTranslation();
  const credits = useGetCredits();
  const pricing = useGetCreditPricing();
  const specialist = specialistFor(taskType);

  const run = useFillRun({ taskType, input, matchesInput, startFailedMessage: t('ai.fill.startFailed') });

  // Guardado pelo id do run, não por um booleano: a pesquisa resolve o mesmo
  // run completo a cada refetch, e um onFilled por render sobrescreveria o que
  // o fundador editou depois de a proposta chegar. Um booleano que virasse
  // `true` para sempre também impediria um SEGUNDO run (gerar de novo) de
  // disparar `onFilled` outra vez — por isso a chave é o id, não um flag.
  const applied = useRef<string | null>(null);

  const proposal = run.state === 'done' ? parseFillProposal(run.output, allowedPaths) : null;

  useEffect(() => {
    if (!proposal?.ok || !run.runId || applied.current === run.runId) return;
    applied.current = run.runId;
    onFilled(proposal.value.filled, run.runId, run.isAdopted);
    // Disparado na mudança de run, não a cada render: `proposal` é um objeto
    // novo toda vez e `onFilled` costuma ser uma closure nova também.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.runId, proposal?.ok]);

  const cost = pricing.data?.operations.find((operation) => operation.taskType === taskType)?.credits ?? null;
  const balance = credits.data ? availableCredits(credits.data) : null;
  // Orientação, não autorização. Enquanto preço ou saldo não resolveram,
  // `short` fica falso: um fundador com saldo nunca é bloqueado por rede lenta.
  const short = cost !== null && balance !== null && balance < cost;

  // O bloco de partida: um só, para todas as vezes em que se pede um run — o
  // primeiro clique, o "gerar de novo" depois da proposta e as duas telas de
  // erro. Cada uma delas era um botão outline solto, sem especialista, sem
  // preço e sem aviso de saldo: o fundador clicava em "tentar de novo" sem
  // saber que aquilo custava outro crédito.
  //
  // Declarado antes dos returns porque os ramos de erro estão acima.
  const startBlock = (startLabel: string) => (
    <div className="space-y-2">
      {/* Who is about to do the work. The landing page named these four; the
          product would otherwise offer an anonymous "generate with AI". */}
      {specialist && <SpecialistByline specialist={specialist} />}
      <Button size="sm" className="gap-2" disabled={!input || short || run.isStarting} onClick={run.start}>
        <Sparkles className="size-4" /> {startLabel}
      </Button>
      {cost !== null && <p className="text-xs text-muted-foreground">{t('ai.fill.cost', { credits: cost })}</p>}
      {short && (
        <p className="text-sm text-destructive">
          {t('ai.fill.short')}{' '}
          <Link to="/app/settings/billing" className="underline">
            {t('ai.fill.topUp')}
          </Link>
        </p>
      )}
    </div>
  );

  if (blockedReason) {
    return (
      <p className="text-sm text-muted-foreground">
        {blockedReason.message}{' '}
        {blockedReason.to && (
          <Link to={blockedReason.to} className="underline">
            {blockedReason.linkLabel ?? t('ai.fill.goThere')}
          </Link>
        )}
      </p>
    );
  }

  // `starting` ainda não tem run para cancelar nem para cronometrar — é a
  // janela do POST. Só o `running` ganha o card com relógio e saída.
  if (run.state === 'starting') {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t('ai.fill.thinking')}
      </p>
    );
  }

  if (run.state === 'running') {
    return (
      <RunningRunCard
        startedAt={run.startedAt}
        isForeign={run.isForeign}
        onCancel={run.cancel}
        isCancelling={run.isCancelling}
      />
    );
  }

  // Gated on `error !== null`, not on `state === 'failed'`: a create failure
  // leaves `useFillRun`'s state at `'idle'` with a non-null `error` (there is
  // no run yet for `state` to describe as failed), and `state === 'failed'`
  // alone would show no message at all for that case. Whenever `state` really
  // is `'failed'`, `useFillRun` guarantees `error` is non-null too (it falls
  // back to `t('ai.fill.failed')`), so this one check covers both.
  if (run.error !== null) {
    // Um run que falhou já foi cobrado e já foi estornado (`onRunFailed` no
    // backend). Um create que falhou nunca debitou nada — prometer estorno ali
    // seria mentira, e é `state` que separa os dois: create falho fica em
    // 'idle' com erro.
    const runFailed = run.state === 'failed';
    const kind = fillErrorKind(run.error);
    return (
      <FillErrorCard
        title={t(`ai.fill.error.${kind}.title`)}
        // Erro de create traz mensagem da API, escrita para ser lida; erro de
        // run traz jargão do runner, que vai para os detalhes técnicos.
        body={runFailed ? t(`ai.fill.error.${kind}.body`) : run.error}
        note={runFailed ? t('ai.fill.error.refunded') : undefined}
        technical={runFailed ? run.error : null}
      >
        {startBlock(t('ai.fill.retry'))}
      </FillErrorCard>
    );
  }

  // Resultado que não passa no parser: um run malformado precisa de mensagem e
  // de uma saída, nunca de meia tela renderizada a partir de campos que
  // ninguém confirmou existir.
  if (proposal && !proposal.ok) {
    return (
      <FillErrorCard
        title={t('ai.fill.error.unreadable.title')}
        body={t('ai.fill.error.unreadable.body')}
        // Este run COMPLETOU — não há estorno, ao contrário do run que falha.
        // Dizer isso é o que impede a surpresa no extrato depois.
        note={t('ai.fill.error.charged')}
      >
        {startBlock(t('ai.fill.retry'))}
      </FillErrorCard>
    );
  }

  if (proposal?.ok) {
    // `run.runId` is guaranteed non-null here: `proposal` only exists when
    // `run.state === 'done'`, which itself only happens once `run.data` has
    // resolved for a non-null `activeId` — the same id `useFillRun` returns
    // as `runId`.
    const runId = run.runId as string;
    const questions = filterQuestions ? proposal.value.questions.filter(filterQuestions) : proposal.value.questions;
    return (
      <div className="space-y-3">
        <AiFillPanel questions={questions} onAnswer={(path, value) => onAnswer(path, value, runId)} />
        {startBlock(t('ai.fill.again'))}
      </div>
    );
  }

  return startBlock(label);
}
