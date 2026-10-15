import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Check, Compass, FlaskConical, Target, Telescope, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const stages = [
  { n: '01', to: '/app/business', key: 'business', icon: Building2 },
  { n: '02', to: '/app/business/icps', key: 'icps', icon: Users },
  { n: '03', to: '/app/goals', key: 'goals', icon: Target },
  { n: '04', to: '/app/research', key: 'research', icon: Telescope },
  { n: '05', to: '/app/strategies', key: 'strategies', icon: Compass },
  { n: '06', to: '/app/experiments', key: 'experiments', icon: FlaskConical },
];

/** The AUREA growth loop as a HUD navigation rail — the app's signature motif. */
export function LoopRail() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  // Prefix, not equality: the rail is a progress indicator, so it keeps
  // pointing at the stage while the user works inside it — an experiment's own
  // page is still the Experiments stage. The trailing-slash guard stops
  // /app/goals from claiming a hypothetical /app/goalsomething. Longest prefix
  // wins: /app/business/icps is the ICP stage, not the business one.
  const activeIndex = stages.reduce((best, s, i) => {
    if (pathname !== s.to && !pathname.startsWith(`${s.to}/`)) return best;
    return best === -1 || s.to.length > (stages[best]?.to.length ?? 0) ? i : best;
  }, -1);

  return (
    <div className="mb-8 -mx-1 overflow-x-auto pb-1">
      <div className="flex min-w-max items-stretch gap-0">
        {stages.map((s, i) => {
          const isActive = i === activeIndex;
          const isPast = activeIndex > -1 && i < activeIndex;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center">
              <NavLink
                to={s.to}
                // A step rail has to say which step is current, not only look
                // like it: the styling below and this marker read the same index.
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all',
                  isActive
                    ? 'bg-primary/10 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-primary)_40%,transparent)]'
                    : 'hover:bg-accent/50',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-md text-[11px] transition-all',
                    isActive
                      ? 'bg-gradient-to-br from-brand to-aura text-white'
                      : isPast
                        ? 'bg-primary/15 text-primary'
                        : 'border border-border/70 bg-card/50 text-muted-foreground',
                  )}
                >
                  {isPast ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className="flex flex-col leading-tight">
                  <span
                    className={cn(
                      'font-mono text-[10px] tracking-widest',
                      isActive ? 'text-aura' : 'text-muted-foreground/60',
                    )}
                  >
                    {s.n}
                  </span>
                  <span className={cn('text-xs font-semibold', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                    {t(`app.nav.${s.key}`)}
                  </span>
                </span>
              </NavLink>
              {i < stages.length - 1 && (
                <span className="mx-1.5 flex w-7 shrink-0 items-center" aria-hidden>
                  <span className={cn('h-px w-full', isPast ? 'bg-primary/50' : 'bg-border')} />
                  <span
                    className={cn(
                      'size-1 shrink-0 rounded-full',
                      isPast ? 'bg-primary/60' : 'bg-border',
                    )}
                  />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
