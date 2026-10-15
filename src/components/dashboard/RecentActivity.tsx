import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { recentHref } from '@/lib/dashboard-actions';
import { Card, CardContent } from '@/components/ui/card';
import type { DashboardRecentItem } from '@/lib/dashboard-types';

// See `@/lib/dashboard-types` for why this wire-shape leaf is narrowed to a
// string instead of the generated `Date`. Re-exported here so every existing
// import of `DashboardRecentItem` from this module keeps resolving.
export type { DashboardRecentItem } from '@/lib/dashboard-types';

export function RecentActivity({ items }: { items: DashboardRecentItem[] }) {
  const { t, i18n } = useTranslation();
  const relative = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short' });

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          {t('app.dashboard.recentTitle')}
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('app.dashboard.recentEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((entry) => {
              const href = recentHref(entry.refType, entry.refId);
              // A research run whose output could not be parsed reports
              // `count: null` (refused or half-written run), not zero
              // findings. i18next would otherwise select `_other` on the
              // normalised 0 and claim the run found nothing. `_unknown` is
              // an ordinary key, not a plural suffix, so it must be picked
              // explicitly rather than left to i18next's count selection.
              const key =
                entry.kind === 'RESEARCH_COMPLETED' && entry.count === null
                  ? 'app.dashboard.recent.RESEARCH_COMPLETED_unknown'
                  : `app.dashboard.recent.${entry.kind}`;
              const copy = t(key, {
                label: entry.label,
                // i18next picks the plural form from `count`; passing null
                // would print "null", so it is normalised here.
                count: entry.count ?? 0,
                value: entry.value ?? '',
                unit: entry.unit ?? '',
              });
              return (
                <li key={`${entry.kind}-${entry.refId}`} data-testid="recent-row" className="flex gap-3 text-sm">
                  <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">
                    {relative.format(new Date(entry.at))}
                  </span>
                  {href ? (
                    <Link to={href} className="hover:text-primary">
                      {copy}
                    </Link>
                  ) : (
                    <span>{copy}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
