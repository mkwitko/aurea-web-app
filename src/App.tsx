import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { WorkspaceGate } from './components/WorkspaceGate';
import { useUiMode } from './lib/ui-mode';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

// The signed-in application is split out of the entry bundle. A first-time
// visitor lands on `/` and should not download the dashboard, the wizards and
// every generated query hook to read a landing page.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const BusinessPage = lazy(() => import('./pages/BusinessPage').then((m) => ({ default: m.BusinessPage })));
const IcpNewPage = lazy(() => import('./pages/IcpNewPage').then((m) => ({ default: m.IcpNewPage })));
const GoalsPage = lazy(() => import('./pages/GoalsPage').then((m) => ({ default: m.GoalsPage })));
const GoalNewPage = lazy(() => import('./pages/GoalNewPage').then((m) => ({ default: m.GoalNewPage })));
const ResearchPage = lazy(() => import('./pages/ResearchPage').then((m) => ({ default: m.ResearchPage })));
const StrategiesPage = lazy(() => import('./pages/StrategiesPage').then((m) => ({ default: m.StrategiesPage })));
const GrowthPage = lazy(() => import('./pages/GrowthPage').then((m) => ({ default: m.GrowthPage })));
const StrategyNewPage = lazy(() => import('./pages/StrategyNewPage').then((m) => ({ default: m.StrategyNewPage })));
const StrategyDetailPage = lazy(() =>
  import('./pages/StrategyDetailPage').then((m) => ({ default: m.StrategyDetailPage })),
);
const ExperimentsPage = lazy(() => import('./pages/ExperimentsPage').then((m) => ({ default: m.ExperimentsPage })));
const LearningsPage = lazy(() => import('./pages/LearningsPage').then((m) => ({ default: m.LearningsPage })));
const ExperimentDetailPage = lazy(() =>
  import('./pages/ExperimentDetailPage').then((m) => ({ default: m.ExperimentDetailPage })),
);
const ExperimentNewPage = lazy(() =>
  import('./pages/ExperimentNewPage').then((m) => ({ default: m.ExperimentNewPage })),
);
const ActionsPage = lazy(() => import('./pages/ActionsPage').then((m) => ({ default: m.ActionsPage })));
const ActionNewPage = lazy(() => import('./pages/ActionNewPage').then((m) => ({ default: m.ActionNewPage })));
const ActionDetailPage = lazy(() =>
  import('./pages/ActionDetailPage').then((m) => ({ default: m.ActionDetailPage })),
);
const BusinessContextSectionPage = lazy(() =>
  import('./pages/BusinessContextSectionPage').then((m) => ({ default: m.BusinessContextSectionPage })),
);
const BillingPage = lazy(() => import('./pages/BillingPage').then((m) => ({ default: m.BillingPage })));
const IntegrationsPage = lazy(() =>
  import('./pages/IntegrationsPage').then((m) => ({ default: m.IntegrationsPage })),
);
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));
const WorkspaceNewPage = lazy(() => import('./pages/WorkspaceNewPage').then((m) => ({ default: m.WorkspaceNewPage })));

function Protected({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      {/* Sem workspace não há app: toda rota de domínio responde 403. O gate
          fica fora do AppLayout de propósito — a shell (nav, switcher, chip de
          crédito) não tem o que mostrar nesse estado. */}
      <WorkspaceGate>
        <AppLayout>
          <Suspense fallback={<div className="h-64" aria-busy="true" />}>{children}</Suspense>
        </AppLayout>
      </WorkspaceGate>
    </ProtectedRoute>
  );
}

/**
 * A list page the redesign folded into `/app/growth/<stage>`. In simple mode
 * (the default) the route redirects there instead of rendering the raw page;
 * the wrapper page still exists — and still renders normally here — for
 * advanced mode, and for anything that still links to it directly (a
 * redirect resolves that too, it just costs one extra hop).
 */
export function ListRoute({ stage, page }: { stage: string; page: ReactNode }) {
  const { mode } = useUiMode();
  if (mode === 'simple') return <Navigate to={`/app/growth/${stage}`} replace />;
  return <>{page}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Fora do `Protected`: é o destino do WorkspaceGate, e passar por ele
          aqui seria um laço de redirect. */}
      <Route
        path="/app/workspaces/new"
        element={
          <ProtectedRoute>
            <Suspense fallback={<div className="h-64" aria-busy="true" />}>
              <WorkspaceNewPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="/app" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/app/onboarding" element={<Protected><OnboardingPage /></Protected>} />
      {/* The old 8-step guide's per-step and hypothesis-id routes — the
          concierge (Phase 5) is a single screen per stage with no step in
          the url, so both collapse to the one route above. */}
      <Route path="/app/onboarding/hypothesis/:id" element={<Navigate to="/app/onboarding" replace />} />
      <Route path="/app/onboarding/:step" element={<Navigate to="/app/onboarding" replace />} />
      <Route path="/app/business" element={<Protected><BusinessPage /></Protected>} />
      <Route path="/app/business/profile" element={<Protected><BusinessPage tab="profile" /></Protected>} />
      <Route path="/app/business/icps" element={<Protected><BusinessPage tab="icps" /></Protected>} />
      {/* Rota antiga do formulário-base — o destino agora é a aba de perfil. */}
      <Route path="/app/business/setup" element={<Navigate to="/app/business/profile" replace />} />
      <Route path="/app/business/context/:section" element={<Protected><BusinessContextSectionPage /></Protected>} />
      <Route path="/app/business/context/wizard" element={<Navigate to="/app/business" replace />} />
      {/* Lista antiga de ICPs — virou aba do Negócio; o formulário continua rota própria. */}
      <Route path="/app/icps" element={<Navigate to="/app/business/icps" replace />} />
      <Route path="/app/icps/new" element={<Protected><IcpNewPage /></Protected>} />
      <Route path="/app/goals" element={<Protected><ListRoute stage="goals" page={<GoalsPage />} /></Protected>} />
      <Route path="/app/goals/new" element={<Protected><GoalNewPage /></Protected>} />
      <Route
        path="/app/research"
        element={<Protected><ListRoute stage="research" page={<ResearchPage />} /></Protected>}
      />
      <Route
        path="/app/strategies"
        element={<Protected><ListRoute stage="strategies" page={<StrategiesPage />} /></Protected>}
      />
      <Route path="/app/strategies/new" element={<Protected><StrategyNewPage /></Protected>} />
      <Route path="/app/strategies/:id" element={<Protected><StrategyDetailPage /></Protected>} />
      <Route
        path="/app/learnings"
        element={<Protected><ListRoute stage="learnings" page={<LearningsPage />} /></Protected>}
      />
      <Route
        path="/app/experiments"
        element={<Protected><ListRoute stage="experiments" page={<ExperimentsPage />} /></Protected>}
      />
      <Route path="/app/experiments/new" element={<Protected><ExperimentNewPage /></Protected>} />
      <Route path="/app/experiments/:id" element={<Protected><ExperimentDetailPage /></Protected>} />
      <Route path="/app/growth/:stage?" element={<Protected><GrowthPage /></Protected>} />
      <Route path="/app/actions" element={<Protected><ActionsPage /></Protected>} />
      <Route path="/app/actions/new" element={<Protected><ActionNewPage /></Protected>} />
      <Route path="/app/actions/:id" element={<Protected><ActionDetailPage /></Protected>} />
      {/* The backend's Stripe RETURN_PATH — renaming this breaks checkout return. */}
      <Route path="/app/settings/billing" element={<Protected><BillingPage /></Protected>} />
      <Route path="/app/settings/integrations" element={<Protected><IntegrationsPage /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
