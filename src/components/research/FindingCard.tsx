import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Finding } from '@/schemas/research-findings';
import { Help } from '@/components/Help';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface FindingCardProps {
  finding: Finding;
  /**
   * What the founder can do about this finding — rendered at the bottom of the
   * card. The card itself owns no decision: the deck knows whether this one is
   * already in the context, and a checkbox here would have to guess.
   */
  footer?: ReactNode;
}

/**
 * One research finding, rendered for the founder to judge and, if it holds
 * up, accept into their business context — the AI's claim, the quote backing
 * it, and where that quote came from, so a decision never rests on the claim
 * alone. Sibling of ProposalOptionCard: same layer, same conventions.
 */
export function FindingCard({ finding, footer }: FindingCardProps) {
  const { t } = useTranslation();

  // A model-chosen url is not guaranteed to parse, and its scheme is hostile
  // input: the model picked it off an attacker-controlled page, and Zod's
  // `.url()` — which is all the older stored rows ever passed through — accepts
  // `javascript:`, `data:` and `vbscript:`. The backend now refuses those on the
  // way in, but rows written before that guard existed must not be clickable
  // here either. Only http and https become links; anything else stays text.
  //
  // Both facts come out of the same parse, because the scheme is available at
  // exactly the point the host already was. Note that `host` is the empty
  // string for a `javascript:` url — the domain label would go silent in the
  // one case where the founder most needs to see where a link goes — so an
  // empty host is normalised to null rather than rendered as a bare separator.
  //
  // A url that fails to parse stays a link, unchanged: a string the URL parser
  // rejects has no valid scheme at all, so the browser resolves it against this
  // app's own origin and it cannot carry an executable one. It just shows no
  // domain, since there is none to read.
  const source = (() => {
    try {
      const url = new URL(finding.sourceUrl);
      return {
        host: url.host || null,
        linkable: url.protocol === 'http:' || url.protocol === 'https:',
      };
    } catch {
      return { host: null, linkable: true };
    }
  })();

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center">
            <Badge variant="outline">{t(`pages.research.dimension.${finding.dimension}`)}</Badge>
            <Help title={t('pages.research.dimensionHelpTitle')}>{t('pages.research.dimensionHelp')}</Help>
          </span>
          <span className="inline-flex items-center">
            <Badge variant="muted">{t(`pages.research.confidence.${finding.confidence}`)}</Badge>
            <Help title={t('pages.research.confidenceHelpTitle')}>{t('pages.research.confidenceHelp')}</Help>
          </span>
        </div>

        <p className="font-medium">{finding.statement}</p>

        <blockquote className="border-l-2 pl-3 text-sm italic text-muted-foreground">{finding.evidence}</blockquote>

        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {source.linkable ? (
            <a
              href={finding.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              {finding.sourceTitle}
            </a>
          ) : (
            <span className="font-medium text-muted-foreground">{finding.sourceTitle}</span>
          )}
          {source.host !== null && (
            <>
              <span aria-hidden="true" className="text-muted-foreground">
                ·
              </span>
              <span className="text-muted-foreground">{source.host}</span>
            </>
          )}
        </div>

        {finding.target === 'COMPETITOR' && finding.competitor && (
          <div className="space-y-2 rounded-md border p-3">
            <p className="font-medium">{finding.competitor.name}</p>
            {finding.competitor.positioning && (
              <p className="text-sm text-muted-foreground">{finding.competitor.positioning}</p>
            )}
            {/* The schema defaults `strengths`/`weaknesses` to an empty array
                rather than omitting them, so an empty list is a valid value —
                without this guard the label would sit above nothing. */}
            {finding.competitor.strengths.length > 0 && (
              <div>
                <p className="text-sm font-medium">{t('pages.research.strengthsLabel')}</p>
                <ul className="list-disc pl-4 text-sm text-muted-foreground">
                  {finding.competitor.strengths.map((strength, index) => (
                    // Index, not the string itself: the schema does not
                    // enforce uniqueness on these entries.
                    <li key={index}>{strength}</li>
                  ))}
                </ul>
              </div>
            )}
            {finding.competitor.weaknesses.length > 0 && (
              <div>
                <p className="text-sm font-medium">{t('pages.research.weaknessesLabel')}</p>
                <ul className="list-disc pl-4 text-sm text-muted-foreground">
                  {finding.competitor.weaknesses.map((weakness, index) => (
                    <li key={index}>{weakness}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {footer}
      </CardContent>
    </Card>
  );
}
