import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CardDeckProps {
  /** How many cards the deck holds. Never zero: an empty deck has no card to show. */
  count: number;
  /** Controlled position, so the caller can move the deck itself — advancing after a save, or opening on the recommendation. */
  at: number;
  onAt: (index: number) => void;
  /** Where the founder is, in the caller's own words ("Finding 3 of 8"). */
  position: ReactNode;
  /** Optional line on the right of the header — a progress count, usually. */
  aside?: ReactNode;
  /** Accessible name for the jump-to-card dot at `index`. */
  dotLabel: (index: number) => string;
  /** Extra classes for the dot at `index` — how the caller marks state (kept, recommended). */
  dotClass?: (index: number) => string;
  renderCard: (index: number) => ReactNode;
  /** Controls that belong next to the arrows: save-all, help, whatever the screen needs. */
  actions?: ReactNode;
  labels: { prev: string; next: string };
}

/**
 * One card at a time, with a way to reach any other.
 *
 * Both AI review screens — research findings and strategy options — used to
 * render every card at once and read as a wall: nothing said how many claims
 * there were or which one was being judged, and on a phone the founder scrolled
 * past the decision. This is the shared shape: position, jumpable dots, arrows,
 * keyboard, and a slot for whatever action the screen puts beside them.
 *
 * The position is controlled by the caller because the caller is what moves it
 * for reasons the deck cannot know: the research deck advances after a card is
 * kept, and the strategy deck opens on AUREA's recommendation.
 */
export function CardDeck({
  count,
  at,
  onAt,
  position,
  aside,
  dotLabel,
  dotClass,
  renderCard,
  actions,
  labels,
}: CardDeckProps) {
  const { t } = useTranslation();
  // Preso à faixa aqui, e não em cada chamador: `at` pode vir de um estado que
  // sobreviveu a uma lista mais curta, e um índice fora da faixa renderizaria
  // um card vazio.
  const current = Math.max(0, Math.min(count - 1, at));
  const go = (next: number) => onAt(Math.max(0, Math.min(count - 1, next)));

  // Seta para andar no deck. Nenhum deck tem campo de texto, mas um listener de
  // janela alcança qualquer foco, então a checagem de alvo evita roubar a seta
  // de quem estiver digitando em outro lugar da página.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.key === 'ArrowLeft') go(current - 1);
      if (event.key === 'ArrowRight') go(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, count]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium" aria-live="polite">
          {position}
        </p>
        {aside}
      </div>

      {/* Os pontos são navegáveis de propósito: um deck sem atalho para o card
          que o fundador quer rever obriga a passar por todos os outros. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: count }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-current={index === current ? 'true' : undefined}
            aria-label={dotLabel(index)}
            onClick={() => go(index)}
            className={[
              'size-2.5 rounded-full transition-colors',
              index === current ? 'bg-primary' : dotClass?.(index) ?? 'bg-muted-foreground/30',
            ].join(' ')}
          />
        ))}
      </div>

      {renderCard(current)}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={current === 0} onClick={() => go(current - 1)}>
          <ChevronLeft className="size-4" />
          {t(labels.prev)}
        </Button>
        <Button size="sm" variant="outline" disabled={current >= count - 1} onClick={() => go(current + 1)}>
          {t(labels.next)}
          <ChevronRight className="size-4" />
        </Button>
        {actions}
      </div>
    </div>
  );
}
