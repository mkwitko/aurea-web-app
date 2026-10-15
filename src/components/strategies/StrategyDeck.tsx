import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useGetProposalDraft } from '@/api/generated/hooks/strategiesHooks/useGetProposalDraft';
import type { Proposal } from '@/schemas/strategy-proposal';
import { CardDeck } from '@/components/deck/CardDeck';
import { Help } from '@/components/Help';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { ProposalOptionCard } from '@/components/strategies/ProposalOptionCard';
import { StrategyPlanEditor, type StrategyDraft } from '@/components/strategies/StrategyPlanEditor';

interface StrategyDeckProps {
  runId: string;
  proposal: Proposal;
  /** Opções que já viraram estratégia. Saem do deck: o fundador já decidiu. */
  usedOptionIndexes: number[];
  /** True while the adoption is in flight — the parent owns that mutation. */
  saving: boolean;
  /** Message from a failed adoption, shown next to the button that caused it. */
  error: string | null;
  onAdopt: (optionIndexes: number[], strategy?: StrategyDraft) => void;
}

/**
 * The proposal, one plan at a time — and more than one at a time if the founder
 * wants it.
 *
 * Two changes to what this screen used to be, both from the same complaint. It
 * rendered every option side by side with a single "use this one" button each,
 * which said the choice was one-of-N and final: a founder who wanted the
 * outbound motion *and* the content motion had to pick one and rebuild the other
 * by hand. And the text was the model's, take it or leave it. Now options are
 * ticked, combined into one plan, and that plan is editable before it exists.
 *
 * The combined draft comes from the server, so the merge rule has one
 * implementation — the same one the adoption writes.
 */
export function StrategyDeck({ runId, proposal, usedOptionIndexes, saving, error, onAdopt }: StrategyDeckProps) {
  const { t } = useTranslation();

  // Índices originais que ainda podem ser escolhidos. Tudo que a tela mostra é
  // posição dentro desta lista; tudo que o servidor recebe é o índice original.
  const visible = proposal.options
    .map((_, index) => index)
    .filter((index) => !usedOptionIndexes.includes(index));

  // Abre na recomendação quando ela sobreviveu; senão, na primeira disponível.
  // Guardar a posição visível (não o índice original) é o que mantém o
  // CardDeck, que fala em 0..count-1, coerente com o que está na tela.
  const recommendedAt = visible.indexOf(proposal.recommendedIndex);
  const [at, setAt] = useState(recommendedAt === -1 ? 0 : recommendedAt);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState(false);

  // A seleção guarda índices originais, e descarta os que foram gastos por
  // outra aba enquanto esta tela estava aberta — sem isto o editor abriria
  // sobre uma opção que já não existe no deck.
  const indexes = [...picked].filter((index) => visible.includes(index)).sort((a, b) => a - b);

  // Só busca quando o editor está aberto: o rascunho é uma pergunta sobre uma
  // seleção, e a seleção muda a cada clique de checkbox.
  const draft = useGetProposalDraft(
    runId,
    { optionIndexes: indexes.join(',') },
    { query: { enabled: editing && indexes.length > 0 } },
  );

  const toggle = (index: number) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  if (editing) {
    if (draft.isError) {
      return (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-destructive">{t('pages.strategies.propose.draftFailed')}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => void draft.refetch()}>
                {t('pages.strategies.propose.retryBtn')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                {t('pages.strategies.propose.backBtn')}
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!draft.data) {
      return (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('pages.strategies.propose.buildingDraft')}
            </div>
            {/* Se `indexes` esvaziou (opção gasta por outra aba enquanto a tela
                estava aberta), a query fica `enabled: false` e este estado nunca
                sai sozinho — sem uma volta, a tela travaria aqui para sempre. */}
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              {t('pages.strategies.propose.backBtn')}
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <StrategyPlanEditor
        // Remonta quando a semente muda: o formulário guarda o texto em estado
        // próprio, e uma semente nova com o estado antigo mostraria a edição de
        // uma combinação que não é mais a escolhida.
        key={indexes.join(',')}
        draft={draft.data.strategy}
        combining={indexes.map((index) => proposal.options[index]!.name)}
        saving={saving}
        error={error}
        onSubmit={(edited) => onAdopt(indexes, edited)}
        onBack={() => setEditing(false)}
      />
    );
  }

  const position = Math.min(at, visible.length - 1);
  const currentIndex = visible[position]!;
  const current = proposal.options[currentIndex]!;
  const isRecommended = (index: number) => index === proposal.recommendedIndex;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{proposal.rationale}</p>

      <CardDeck
        count={visible.length}
        at={at}
        onAt={setAt}
        labels={{ prev: 'pages.strategies.propose.prevBtn', next: 'pages.strategies.propose.nextBtn' }}
        position={
          <>
            {t('pages.strategies.propose.planPosition', { position: position + 1, total: visible.length })}
            <Help title={t('pages.strategies.propose.combineHelpTitle')}>
              {t('pages.strategies.propose.combineHelp')}
            </Help>
          </>
        }
        aside={
          <p className="text-xs text-muted-foreground">
            {t('pages.strategies.propose.pickedCount', { picked: picked.size })}
          </p>
        }
        dotLabel={(index) => t('pages.strategies.propose.goToPlan', { position: index + 1 })}
        // O ponto marcado diz o que já entra no plano, sem passar por todos os
        // cards para conferir.
        dotClass={(index) => (picked.has(visible[index]!) ? 'bg-primary/40' : 'bg-muted-foreground/30')}
        renderCard={(index) => {
          const optionIndex = visible[index]!;
          return (
            <ProposalOptionCard
              option={proposal.options[optionIndex]!}
              isRecommended={isRecommended(optionIndex)}
              footer={
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`pick-option-${optionIndex}`}
                    checked={picked.has(optionIndex)}
                    disabled={saving}
                    onCheckedChange={() => toggle(optionIndex)}
                  />
                  <label htmlFor={`pick-option-${optionIndex}`} className="text-sm">
                    {t('pages.strategies.propose.includeLabel')}
                  </label>
                </div>
              }
            />
          );
        }}
        actions={
          // Trava por `indexes` (picked ∩ visible), não por `picked.size`: uma
          // opção marcada pode ter sido gasta por outra aba enquanto esta
          // tela ficava aberta, e nesse caso `indexes` já esvaziou mesmo com
          // `picked` cheio — abrir o editor com seleção vazia desabilita a
          // busca do rascunho (`enabled: indexes.length > 0`) e prende a tela
          // no branch de loading.
          <Button size="sm" disabled={saving || indexes.length === 0} onClick={() => setEditing(true)}>
            {picked.size > 1
              ? t('pages.strategies.propose.combineBtn', { count: picked.size })
              : t('pages.strategies.propose.reviewBtn')}
          </Button>
        }
      />

      {/* Fora do deck: o erro é da adoção, e a adoção acontece no editor — mas
          uma volta ao deck depois de falhar não pode engolir a mensagem. */}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {isRecommended(currentIndex) && (
        <p className="text-xs text-muted-foreground">
          {t('pages.strategies.propose.recommendedHint', { name: current.name })}
        </p>
      )}
    </div>
  );
}
