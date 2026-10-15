import { lazy, Suspense, type ComponentType } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { useGetDashboard } from '@/api/generated/hooks/dashboardHooks/useGetDashboard';
import { GrowthLoop } from '@/components/growth/GrowthLoop';
import { Help } from '@/components/Help';
import { PageHeader } from '@/components/PageHeader';
import { SectionLoading } from '@/components/SectionState';
import { Button } from '@/components/ui/button';
import {
  defaultGrowthStage,
  deriveGrowthStageStates,
  isGrowthStage,
  type GrowthStageKey,
} from '@/lib/growth-stages';

// Split out of the GrowthPage bundle the same way App.tsx already splits the
// standalone pages: a founder opening one stage should not download the code
// for the other four.
const GoalsPanel = lazy(() => import('@/components/growth/GoalsPanel').then((m) => ({ default: m.GoalsPanel })));
const ResearchPanel = lazy(() =>
  import('@/components/research/ResearchPanel').then((m) => ({ default: m.ResearchPanel })),
);
const StrategiesPanel = lazy(() =>
  import('@/components/growth/StrategiesPanel').then((m) => ({ default: m.StrategiesPanel })),
);
const ExperimentsPanel = lazy(() =>
  import('@/components/growth/ExperimentsPanel').then((m) => ({ default: m.ExperimentsPanel })),
);
const LearningsPanel = lazy(() =>
  import('@/components/growth/LearningsPanel').then((m) => ({ default: m.LearningsPanel })),
);

const PANELS: Record<GrowthStageKey, ComponentType> = {
  goals: GoalsPanel,
  research: ResearchPanel,
  strategies: StrategiesPanel,
  experiments: ExperimentsPanel,
  learnings: LearningsPanel,
};

// The "Novo" button each stage's PageHeader used to carry. Research and
// learnings have none: research starts a run from inside its own panel, and a
// learning is never created directly — it comes out of an experiment.
const NEW_ROUTE: Partial<Record<GrowthStageKey, string>> = {
  goals: '/app/goals/new',
  strategies: '/app/strategies/new',
  experiments: '/app/experiments/new',
};

/**
 * The merged Crescimento screen: one stepper over the five growth-loop
 * stages, one stage's panel rendered below it. `stage` lives in the URL
 * (`/app/growth/:stage?`) rather than in local state, so a direct link to
 * `/app/growth/experiments` opens straight there, and switching stages never
 * remounts this page — only the lazy panel underneath changes.
 */
export function GrowthPage() {
  const { t } = useTranslation();
  const { stage } = useParams<{ stage?: string }>();
  const dashboard = useGetDashboard();

  if (!stage) {
    // Waits for the dashboard rather than defaulting to "goals" outright: a
    // founder who has already done everything would otherwise flash on the
    // wrong stage for one frame before bouncing to the right one.
    if (dashboard.isLoading) return <SectionLoading />;
    const fallback = defaultGrowthStage(dashboard.data?.setup, dashboard.data?.pendingMeasurement.count ?? 0);
    return <Navigate to={`/app/growth/${fallback}`} replace />;
  }

  if (!isGrowthStage(stage)) {
    return <Navigate to="/app/growth/goals" replace />;
  }

  const states = deriveGrowthStageStates(dashboard.data?.setup, dashboard.data?.pendingMeasurement.count ?? 0);
  const Panel = PANELS[stage];
  const newTo = NEW_ROUTE[stage];

  return (
    <div>
      <PageHeader
        eyebrow={t('app.nav.groups.growth')}
        title={t('app.growth.title')}
        subtitle={t('app.growth.subtitle')}
      />

      <GrowthLoop activeStage={stage} states={states} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          {t(`pages.${stage}.title`)}
          <Help title={t(`pages.${stage}.helpTitle`)}>{t(`pages.${stage}.help`)}</Help>
        </h2>
        {newTo && (
          <Button asChild size="sm">
            <Link to={newTo}>
              <Plus className="size-4" /> {t('crud.new')}
            </Link>
          </Button>
        )}
      </div>

      <div id="growth-stage-panel" role="tabpanel" aria-labelledby={`growth-tab-${stage}`}>
        <Suspense fallback={<SectionLoading />}>
          <Panel />
        </Suspense>
      </div>
    </div>
  );
}
