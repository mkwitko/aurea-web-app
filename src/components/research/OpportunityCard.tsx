import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Opportunity } from '@/schemas/research-findings';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface OpportunityCardProps {
  opportunity: Opportunity;
  /** What the founder can do about it — same contract as `FindingCard`. */
  footer?: ReactNode;
}

/**
 * One opportunity the agent drew from its own findings. An opportunity is not a
 * finding: it has no source of its own, because it is AUREA's reading across
 * several findings — so it shows the reasoning instead of a quote.
 */
export function OpportunityCard({ opportunity, footer }: OpportunityCardProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <Badge variant="muted">{t(`pages.research.confidence.${opportunity.confidence}`)}</Badge>
        <p className="font-medium">{opportunity.statement}</p>
        <p className="text-sm text-muted-foreground">{opportunity.rationale}</p>
        {footer}
      </CardContent>
    </Card>
  );
}
