import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProposedOption } from '@/schemas/strategy-proposal';
import { Help } from '@/components/Help';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface ProposalOptionCardProps {
  option: ProposedOption;
  isRecommended: boolean;
  /**
   * What the founder can do about this option — rendered at the bottom of the
   * card. The card owns no decision of its own: the deck knows what is already
   * ticked and whether an adoption is in flight.
   */
  footer?: ReactNode;
}

/**
 * One proposed growth strategy option, rendered for the founder to compare
 * and pick from — never pre-selected. Split out of ProposeStrategies once
 * that component's per-option branch grew past what fits in one file
 * alongside the run/start/waiting state machine.
 */
export function ProposalOptionCard({ option, isRecommended, footer }: ProposalOptionCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{option.name}</p>
          {isRecommended && (
            <span className="inline-flex items-center">
              <Badge variant="muted">{t('pages.strategies.propose.recommended')}</Badge>
              {/* The only signal telling "AUREA's suggestion" apart from "the
                  decision already made" — this label is the whole reason the
                  no-pre-selection rule needs its own explanation here. */}
              <Help title={t('pages.strategies.propose.recommendedHelpTitle')}>
                {t('pages.strategies.propose.recommendedHelp')}
              </Help>
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{option.strategicThesis}</p>
        <div>
          <p className="text-sm font-medium">{t('pages.strategies.propose.tradeoffsLabel')}</p>
          <p className="text-sm text-muted-foreground">{option.tradeoffs}</p>
        </div>
        {/* The schema has no `.min()` on `hypotheses`, so an empty array is
            valid output — without this guard the label would sit above an
            empty list. */}
        {option.hypotheses.length > 0 && (
          <div>
            <p className="text-sm font-medium">
              {t('pages.strategies.propose.hypothesesLabel')}
              <Help title={t('pages.hypotheses.helpTitle')}>{t('pages.hypotheses.help')}</Help>
            </p>
            <ul className="list-disc pl-4 text-sm text-muted-foreground">
              {option.hypotheses.map((hypothesis, index) => (
                // Index, not `hypothesis.statement`: the schema does not
                // enforce uniqueness on that string, so two identically
                // worded hypotheses would collide on a text key. This list is
                // static and order-stable, so the index is safe here.
                <li key={index}>{hypothesis.statement}</li>
              ))}
            </ul>
          </div>
        )}
        {/* What this option leans on from past tests. Shown because "it learns
            from you" is only credible when the founder can see which learning
            was used. */}
        {option.basedOnLearnings && option.basedOnLearnings.length > 0 && (
          <div>
            <p className="text-sm font-medium">{t('pages.strategies.propose.basedOnLabel')}</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {option.basedOnLearnings.map((learning) => (
                <li
                  key={learning}
                  className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                >
                  {learning}
                </li>
              ))}
            </ul>
          </div>
        )}
        {footer}
      </CardContent>
    </Card>
  );
}
