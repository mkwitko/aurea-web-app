import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { useGetDashboard } from '@/api/generated/hooks/dashboardHooks/useGetDashboard';
import { Button } from '@/components/ui/button';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { SetupChecklist } from '../components/dashboard/SetupChecklist';
import { LoopPanel, type DashboardLoop } from '../components/dashboard/LoopPanel';
import { NextActionCard, type DashboardNextAction } from '../components/dashboard/NextActionCard';
import { RecentActivity, type DashboardRecentItem } from '../components/dashboard/RecentActivity';
import { PendingMeasurementCard, type PendingMeasurementItem } from '../components/dashboard/PendingMeasurementCard';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const dashboard = useGetDashboard();

  const firstName = user?.name?.split(' ')[0] ?? '';
  // While loading or on error, nothing better than the setup-flavoured
  // subtitle is known yet — there is no `setup`/`loop` to branch on.
  const setupHeader = (
    <PageHeader title={t('app.dashboard.welcome', { name: firstName })} subtitle={t('app.dashboard.subtitle')} />
  );

  if (dashboard.isLoading) {
    return (
      <div>
        {setupHeader}
        <div className="space-y-6">
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <div className="h-24 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <div>
        {setupHeader}
        <p className="text-sm text-destructive">{t('app.dashboard.error')}</p>
      </div>
    );
  }

  const { setup, loop } = dashboard.data; // untouched fields stay fully checked

  // Kubb types `nextAction.endDate`, `recent[].at` and `loop.experiment.endDate`
  // as `Date` because the OpenAPI schema marks them `date-time`, but the wire
  // format is really an ISO string — nothing here ever gets a live `Date`
  // instance (same fact `NextActionCard`, `RecentActivity` and `LoopPanel`
  // each document via `@/lib/dashboard-types`). The `unknown` bridge below is
  // confined to those three leaf fields, so every other field of
  // `nextAction`, `recent` and `loop` — and all of `setup` — stays checked by
  // `tsc` against the generated response; a renamed or dropped field
  // anywhere else still fails typecheck here.
  const nextAction: DashboardNextAction = {
    ...dashboard.data.nextAction,
    endDate: dashboard.data.nextAction.endDate as unknown as string | null,
  };
  const recent: DashboardRecentItem[] = dashboard.data.recent.map((entry) => ({
    ...entry,
    at: entry.at as unknown as string,
  }));
  const loopNarrowed: DashboardLoop | null = loop && {
    ...loop,
    experiment: loop.experiment && {
      ...loop.experiment,
      endDate: loop.experiment.endDate as unknown as string | null,
    },
  };
  // Mesma ponte `unknown` das outras datas: o campo chega como ISO string
  // apesar de o Kubb tipar `Date`.
  const pendingItems: PendingMeasurementItem[] = dashboard.data.pendingMeasurement.items.map((entry) => ({
    ...entry,
    endDate: entry.endDate as unknown as string | null,
  }));

  const setupComplete = setup.completed === setup.total;
  // Gated on the same condition as the hero swap above so the two forms of
  // the checklist are mutually exclusive by construction — even if `loop`
  // were ever null while `setup` reported complete (an invariant the
  // backend enforces but this file cannot see), only one form would render.
  const showCollapsedChecklist = setupComplete && Boolean(loopNarrowed);
  // Once the founder is in the loop, telling them to "set up" contradicts the
  // loop panel rendered right below — swap to copy that describes where the
  // loop stands instead (spec's post-setup subtitle requirement).
  const header = (
    <PageHeader
      title={t('app.dashboard.welcome', { name: firstName })}
      subtitle={t(setupComplete ? 'app.dashboard.subtitleLoop' : 'app.dashboard.subtitle')}
    />
  );

  return (
    <div>
      {header}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* A próxima ação é o herói: a pergunta que o fundador traz ao abrir
              o app é "o que eu faço agora?" — tudo abaixo é contexto. O guia
              entra como ação secundária do mesmo herói enquanto houver setup. */}
          <NextActionCard
            nextAction={nextAction}
            secondary={
              !setupComplete ? (
                <Button asChild variant="outline" className="gap-2">
                  <Link to="/app/onboarding">
                    <Sparkles className="size-4" /> {t('app.dashboard.startGuide')}
                  </Link>
                </Button>
              ) : undefined
            }
          />
          {setupComplete && loopNarrowed ? (
            <LoopPanel loop={loopNarrowed} />
          ) : (
            <SetupChecklist setup={setup} collapsed={false} />
          )}
          <PendingMeasurementCard count={dashboard.data.pendingMeasurement.count} items={pendingItems} />
          {showCollapsedChecklist && <SetupChecklist setup={setup} collapsed />}
        </div>

        <RecentActivity items={recent} />
      </div>
    </div>
  );
}
