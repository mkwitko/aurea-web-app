import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, Check, ClipboardList, Compass, FlaskConical, Lightbulb, Target, Telescope, Users } from 'lucide-react';
import { Help } from '../Help';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { SETUP_STEPS, type SetupStepKey } from '@/lib/setup-steps';

export interface SetupFlags {
  business: boolean;
  context: boolean;
  icp: boolean;
  goal: boolean;
  research: boolean;
  strategy: boolean;
  hypothesis: boolean;
  experiment: boolean;
  completed: number;
  total: number;
}

/** Um ícone por passo. A ordem, as rotas e as chaves vêm do módulo compartilhado. */
const ICONS: Record<SetupStepKey, typeof Building2> = {
  business: Building2,
  context: ClipboardList,
  icp: Users,
  goal: Target,
  research: Telescope,
  strategy: Compass,
  hypothesis: Lightbulb,
  experiment: FlaskConical,
};

function Rows({ setup }: { setup: SetupFlags }) {
  const { t } = useTranslation();
  return (
    <div className="divide-y divide-border">
      {SETUP_STEPS.map(({ key, route: to, n }) => {
        const Icon = ICONS[key];
        const isDone = setup[key];
        return (
          <div key={key} className="group relative flex items-center gap-4 p-5 transition-colors hover:bg-accent/40">
            <div
              className={cn(
                'grid size-11 shrink-0 place-items-center rounded-xl border transition-colors',
                isDone
                  ? 'border-transparent bg-gradient-to-br from-brand to-aura text-white'
                  : 'border-border bg-card text-muted-foreground group-hover:text-foreground',
              )}
            >
              {isDone ? <Check className="size-5" /> : <Icon className="size-5" />}
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Link to={to} className="font-medium after:absolute after:inset-0 hover:text-primary">
                {t(`app.dashboard.steps.${key}.title`)}
              </Link>
              <Help title={t(`app.dashboard.steps.${key}.help`)}>{t(`app.dashboard.steps.${key}.helpText`)}</Help>
            </div>
            <span className="font-mono text-xs text-muted-foreground">{String(n).padStart(2, '0')}</span>
            <ArrowRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </div>
        );
      })}
    </div>
  );
}

/**
 * The activation checklist. Hero while setup is unfinished; once every step is
 * done it collapses to one summary row, because a founder on day 30 does not
 * need a permanent 5/5 at the top of their dashboard (spec §3.7).
 */
export function SetupChecklist({ setup, collapsed }: { setup: SetupFlags; collapsed: boolean }) {
  const { t } = useTranslation();
  const pct = setup.total === 0 ? 0 : Math.round((setup.completed / setup.total) * 100);
  const [open, setOpen] = useState(false);

  if (collapsed) {
    return (
      <details className="rounded-xl border border-border bg-card px-5 py-3" onToggle={(e) => setOpen(e.currentTarget.open)}>
        <summary className="cursor-pointer font-mono text-xs tracking-wider text-muted-foreground">
          {t('app.dashboard.setupDone', { completed: setup.completed, total: setup.total })}
        </summary>
        {open && (
          <div className="mt-3 -mx-5 -mb-3 border-t border-border">
            <Rows setup={setup} />
          </div>
        )}
      </details>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border p-5">
        <div className="mb-2 flex items-center justify-between font-mono text-xs">
          <span className="tracking-wider text-foreground">
            {setup.completed} / {setup.total}
          </span>
          <span className="text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-aura transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <Rows setup={setup} />
    </Card>
  );
}
