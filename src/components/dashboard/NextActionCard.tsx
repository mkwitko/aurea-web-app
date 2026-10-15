import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { nextActionRoute } from '@/lib/dashboard-actions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DashboardNextAction } from '@/lib/dashboard-types';

// See `@/lib/dashboard-types` for why this wire-shape leaf is narrowed to a
// string instead of the generated `Date`. Re-exported here so every existing
// import of `DashboardNextAction` from this module keeps resolving.
export type { DashboardNextAction } from '@/lib/dashboard-types';

export function NextActionCard({ nextAction, secondary }: { nextAction: DashboardNextAction; secondary?: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { to, i18nKey } = nextActionRoute(nextAction.kind, { experimentId: nextAction.experimentId });

  // A RUNNING experiment can genuinely have no planned end date. The normal
  // WAIT_FOR_EXPERIMENT copy has a "{{date}}" clause built in, so falling
  // back to an empty string there would ship "is running until " — a
  // dangling preposition and a trailing space. This state gets its own copy
  // key instead, kept outside `app.dashboard.next.*` so it never becomes a
  // 17th kind for the exhaustiveness check Task 10 runs over that namespace.
  const noEndDate = nextAction.kind === 'WAIT_FOR_EXPERIMENT' && !nextAction.endDate;

  const copy = t(noEndDate ? 'app.dashboard.waitNoDate' : i18nKey, {
    subject: nextAction.subjectLabel ?? '',
    date: nextAction.endDate
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(nextAction.endDate))
      : '',
  });

  return (
    <Card className="relative overflow-hidden">
      <div aria-hidden className="accent-line absolute inset-x-0 top-0 h-0.5" />
      <CardContent className="p-6 sm:p-8">
        <div className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-aura">
          <span aria-hidden className="size-1.5 rounded-full bg-aura glow-pulse" />
          {t('app.dashboard.nextLabel')}
        </div>
        {/* No route means the stage has no action — waiting is not a click. */}
        {to === null ? (
          <p data-testid="next-action-text" className="font-display text-xl font-semibold leading-snug sm:text-2xl">
            {copy}
          </p>
        ) : (
          <>
            <p className="font-display text-xl font-semibold leading-snug sm:text-2xl">{copy}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to={to}>
                  {t('app.dashboard.go')} <ArrowRight className="size-4" />
                </Link>
              </Button>
              {secondary}
            </div>
          </>
        )}
        {to === null && secondary && <div className="mt-6 flex flex-wrap items-center gap-3">{secondary}</div>}
      </CardContent>
    </Card>
  );
}
