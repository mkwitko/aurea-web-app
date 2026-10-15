import { useTranslation } from 'react-i18next';
import { Check, Circle, Dot } from 'lucide-react';
import { Help } from '../Help';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardLoop } from '@/lib/dashboard-types';

// See `@/lib/dashboard-types` for why `experiment.endDate` is narrowed to a
// string instead of the generated `Date`. Re-exported here so every existing
// import of `DashboardLoop` from this module keeps resolving.
export type { DashboardLoop } from '@/lib/dashboard-types';

const ICONS = { DONE: Check, CURRENT: Dot, TODO: Circle } as const;

export function LoopPanel({ loop }: { loop: DashboardLoop }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="font-mono text-xs uppercase tracking-[0.15em] text-primary">
            {t('app.dashboard.loopTitle', { number: loop.number })}
          </h2>
          <Help title={t('app.dashboard.loopHelp')}>{t('app.dashboard.loopHelpText')}</Help>
        </div>

        <p className="mb-1 text-lg font-medium">{loop.goal ? loop.goal.name : t('app.dashboard.noGoal')}</p>
        {loop.strategy && <p className="mb-5 text-sm text-muted-foreground">{loop.strategy.name}</p>}

        <ol className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {loop.rail.map(({ node, state }) => {
            const Icon = ICONS[state];
            return (
              <li key={node} data-testid="rail-node" data-state={state} className="flex items-center gap-1.5">
                <Icon
                  className={cn(
                    'size-4',
                    state === 'DONE' && 'text-primary',
                    state === 'CURRENT' && 'text-foreground',
                    state === 'TODO' && 'text-muted-foreground/50',
                  )}
                />
                <span className={cn('font-mono text-sm', state === 'TODO' && 'text-muted-foreground')}>
                  {t(`app.dashboard.rail.${node}`)}
                </span>
                <Help title={t(`app.dashboard.rail.${node}`)}>{t(`app.dashboard.railHelp.${node}`)}</Help>
              </li>
            );
          })}
        </ol>

        {loop.experiment && (
          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">{loop.experiment.name}</p>
        )}
      </CardContent>
    </Card>
  );
}
