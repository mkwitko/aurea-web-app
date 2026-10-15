import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Compass, FlaskConical, Lightbulb, Target, Telescope, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GROWTH_STAGES, type GrowthStageKey, type StageStatus } from '@/lib/growth-stages';

const ICONS: Record<GrowthStageKey, LucideIcon> = {
  goals: Target,
  research: Telescope,
  strategies: Compass,
  experiments: FlaskConical,
  learnings: Lightbulb,
};

/**
 * The growth loop as a 5-stage horizontal stepper — GrowthPage's replacement
 * for `LoopRail`. Unlike LoopRail (a progress rail derived from the URL
 * prefix across several pages), every stage here lives on the same route
 * (`/app/growth/:stage`), so "current" comes from the `activeStage` prop —
 * the URL param GrowthPage already parsed — not from matching `pathname`
 * again.
 */
export function GrowthLoop({
  activeStage,
  states,
}: {
  activeStage: GrowthStageKey;
  states: Record<GrowthStageKey, StageStatus>;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="tablist"
      aria-label={t('app.growth.stepperLabel')}
      className="mb-8 -mx-1 overflow-x-auto pb-1"
    >
      <div className="flex min-w-max items-stretch gap-0">
        {GROWTH_STAGES.map((stage, i) => {
          const status = states[stage];
          const isActive = stage === activeStage;
          const Icon = ICONS[stage];
          return (
            <div key={stage} className="flex items-center">
              <Link
                to={`/app/growth/${stage}`}
                role="tab"
                id={`growth-tab-${stage}`}
                aria-selected={isActive}
                aria-current={isActive ? 'step' : undefined}
                aria-controls="growth-stage-panel"
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
                      : status === 'DONE'
                        ? 'bg-primary/15 text-primary'
                        : 'border border-border/70 bg-card/50 text-muted-foreground',
                  )}
                >
                  {status === 'DONE' ? <Check className="size-4" /> : <Icon className="size-4" />}
                </span>
                <span className={cn('text-xs font-semibold', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                  {t(`app.nav.${stage}`)}
                </span>
              </Link>
              {i < GROWTH_STAGES.length - 1 && (
                <span className="mx-1.5 flex w-7 shrink-0 items-center" aria-hidden>
                  <span className={cn('h-px w-full', status === 'DONE' ? 'bg-primary/50' : 'bg-border')} />
                  <span className={cn('size-1 shrink-0 rounded-full', status === 'DONE' ? 'bg-primary/60' : 'bg-border')} />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
