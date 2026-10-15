import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useGetResearchPresence } from '@/api/generated/hooks/businessHooks/useGetResearchPresence';
import { useCreateContextVersionFromResearch } from '@/api/generated/hooks/businessHooks/useCreateContextVersionFromResearch';
import { useRemoveContextVersionFromResearch } from '@/api/generated/hooks/businessHooks/useRemoveContextVersionFromResearch';
import { BUSINESS, DASHBOARD } from '@/api/modules';
import { apiErrorMessage } from '@/lib/api-errors';
import type { Finding, Opportunity } from '@/schemas/research-findings';
import { Help } from '@/components/Help';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardDeck } from '@/components/deck/CardDeck';
import { FindingCard } from '@/components/research/FindingCard';
import { OpportunityCard } from '@/components/research/OpportunityCard';

interface ResearchDeckProps {
  runId: string;
  findings: Finding[];
  opportunities: Opportunity[];
}

/** One card of the deck: which list it came from and where in that list. */
type Item = { kind: 'finding'; index: number } | { kind: 'opportunity'; index: number };

/**
 * The review, one card at a time.
 *
 * The old screen stacked every finding and every opportunity as a checkbox
 * list with a single save button at the bottom, and it read as a wall: nothing
 * said how many claims there were, which one was being judged, or what had
 * already been kept. This deck makes each claim the whole screen, so judging it
 * is one decision, and the decision is immediate — a card is saved or removed on
 * the spot instead of accumulating in a selection that a reload would lose.
 *
 * What is already in the business context comes from the server
 * (`useGetResearchPresence`), never from what this component remembers doing.
 * That is the difference between a mark that survives a reload and one that
 * disappears with the tab — and the founder who reopened this page and found
 * every card offering "keep this" again had no way to tell the two apart.
 */
export function ResearchDeck({ runId, findings, opportunities }: ResearchDeckProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [at, setAt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const presence = useGetResearchPresence(runId);
  const savedFindings = presence.data?.presentFindingIndexes ?? [];
  const savedOpportunities = presence.data?.presentOpportunityIndexes ?? [];

  // Um aceite muda o contexto do negócio, e o contexto é o que decide o que
  // está guardado — então as duas coisas são relidas juntas. `queryKeyRoot`
  // sozinho não bastava: chave de query casa `url` como string inteira, então
  // `/business` nunca casou `/business/context`, e a tela do negócio continuava
  // mostrando a versão anterior depois de um aceite bem-sucedido.
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: BUSINESS.queryKeyRoot }),
      queryClient.invalidateQueries({ queryKey: BUSINESS.contextQueryKey }),
      queryClient.invalidateQueries({ queryKey: BUSINESS.researchPresenceQueryKey }),
      queryClient.invalidateQueries({ queryKey: DASHBOARD.queryKeyRoot }),
    ]);
  };

  const accept = useCreateContextVersionFromResearch({
    mutation: {
      onMutate: () => setError(null),
      onSuccess: refresh,
      onError: (cause) => setError(apiErrorMessage(cause, t('pages.research.acceptFailed'))),
    },
  });

  const remove = useRemoveContextVersionFromResearch({
    mutation: {
      onMutate: () => setError(null),
      onSuccess: refresh,
      onError: (cause) => setError(apiErrorMessage(cause, t('pages.research.removeFailed'))),
    },
  });

  const busy = accept.isPending || remove.isPending;

  // Achados primeiro, oportunidades depois — a ordem da leitura: uma
  // oportunidade é a leitura da AUREA sobre vários achados, e julgá-la antes de
  // ver os achados é julgar no vácuo.
  const items: Item[] = [
    ...findings.map((_, index): Item => ({ kind: 'finding', index })),
    ...opportunities.map((_, index): Item => ({ kind: 'opportunity', index })),
  ];
  // `at` pode sobreviver a uma mudança de run, e um índice fora da faixa
  // renderizaria um card vazio. Preso à faixa em vez de confiar no estado.
  const current = items[Math.min(at, items.length - 1)]!;

  const isSaved = (item: Item) =>
    item.kind === 'finding' ? savedFindings.includes(item.index) : savedOpportunities.includes(item.index);
  // Um achado NONE não tem onde ser arquivado no contexto, então guardar não é
  // uma ação disponível para ele — o servidor recusa o índice.
  const isFileable = (item: Item) => item.kind === 'opportunity' || findings[item.index]!.target !== 'NONE';

  const pending = items.filter((item) => isFileable(item) && !isSaved(item));

  const go = (next: number) => setAt(Math.max(0, Math.min(items.length - 1, next)));

  const save = (list: Item[], advance: boolean) => {
    if (!list.length) return;
    accept.mutate(
      {
        data: {
          agentRunId: runId,
          findingIndexes: list.filter((item) => item.kind === 'finding').map((item) => item.index),
          opportunityIndexes: list.filter((item) => item.kind === 'opportunity').map((item) => item.index),
        },
      },
      // Guardar e ficar parado no mesmo card faria o fundador navegar de novo
      // para cada achado. Avança só quando a decisão foi sobre um card.
      { onSuccess: () => advance && go(at + 1) },
    );
  };

  const unsave = (item: Item) => {
    remove.mutate({
      data: {
        agentRunId: runId,
        findingIndexes: item.kind === 'finding' ? [item.index] : [],
        opportunityIndexes: item.kind === 'opportunity' ? [item.index] : [],
      },
    });
  };

  const footer = (item: Item) => {
    if (!isFileable(item)) {
      return <p className="text-xs text-muted-foreground">{t('pages.research.notFiled')}</p>;
    }

    if (isSaved(item)) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t('pages.research.savedBadge')}</Badge>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => unsave(item)}>
            {remove.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('pages.research.removeBtn')}
          </Button>
        </div>
      );
    }

    return (
      <Button size="sm" disabled={busy} onClick={() => save([item], true)}>
        {accept.isPending && <Loader2 className="size-4 animate-spin" />}
        {t('pages.research.acceptLabel')}
      </Button>
    );
  };

  const position =
    current.kind === 'finding'
      ? t('pages.research.findingPosition', { position: current.index + 1, total: findings.length })
      : t('pages.research.opportunityPosition', { position: current.index + 1, total: opportunities.length });

  return (
    <>
      <CardDeck
        count={items.length}
        at={at}
        onAt={setAt}
        labels={{ prev: 'pages.research.prevBtn', next: 'pages.research.nextBtn' }}
        position={
          <>
            {position}
            {current.kind === 'opportunity' && (
              <Help title={t('pages.research.opportunityHelpTitle')}>{t('pages.research.opportunityHelp')}</Help>
            )}
          </>
        }
        aside={
          <p className="text-xs text-muted-foreground">
            {t('pages.research.savedCount', {
              saved: savedFindings.length + savedOpportunities.length,
              total: items.filter(isFileable).length,
            })}
          </p>
        }
        dotLabel={(index) => t('pages.research.goToCard', { position: index + 1 })}
        // O ponto apagado diz "já guardado": a marca do card não se vê de longe,
        // e o fundador precisa saber o que sobrou sem passar por tudo.
        dotClass={(index) => (isSaved(items[index]!) ? 'bg-primary/40' : 'bg-muted-foreground/30')}
        renderCard={(index) => {
          const item = items[index]!;
          return item.kind === 'finding' ? (
            <FindingCard finding={findings[item.index]!} footer={footer(item)} />
          ) : (
            <OpportunityCard opportunity={opportunities[item.index]!} footer={footer(item)} />
          );
        }}
        actions={
          <>
            {/* Guardar tudo de uma vez é o pedido de quem já acredita na pesquisa
                inteira: sem isto, acreditar em oito achados custa oito decisões.
                Some quando não sobra nada — um botão desligado dizendo "guardar
                os 0 restantes" é ruído no lugar de uma resposta. */}
            {pending.length > 0 ? (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => save(pending, false)}>
                {t('pages.research.saveAllBtn', { remaining: pending.length })}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">{t('pages.research.allKept')}</p>
            )}
            <Help title={t('pages.research.acceptHelpTitle')}>{t('pages.research.acceptHelp')}</Help>
          </>
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
}
