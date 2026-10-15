import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import i18n from '@/i18n';
import { stubFetch } from '@/test/stub-fetch';
import { GrowthPage } from './GrowthPage';

// The panels each own their own data fetching (goals, strategies, agent
// runs, …) — stubbing every one of those endpoints just to prove GrowthPage
// itself routes and steps correctly would test the panels a second time.
// Replacing them with a marker div keeps this file about GrowthPage's own
// job: reading `:stage`, computing the stepper's states, and mounting the
// right panel.
vi.mock('@/components/growth/GoalsPanel', () => ({ GoalsPanel: () => <div>goals-panel</div> }));
vi.mock('@/components/research/ResearchPanel', () => ({ ResearchPanel: () => <div>research-panel</div> }));
vi.mock('@/components/growth/StrategiesPanel', () => ({ StrategiesPanel: () => <div>strategies-panel</div> }));
vi.mock('@/components/growth/ExperimentsPanel', () => ({ ExperimentsPanel: () => <div>experiments-panel</div> }));
vi.mock('@/components/growth/LearningsPanel', () => ({ LearningsPanel: () => <div>learnings-panel</div> }));

const dashboardBase = {
  setup: {
    business: true,
    context: true,
    icp: true,
    goal: true,
    research: true,
    strategy: true,
    hypothesis: true,
    experiment: true,
    completed: 8,
    total: 8,
  },
  stage: 'COMPLETE',
  nextAction: { kind: 'START_NEXT_LOOP', subjectLabel: null, experimentId: null, learningId: null, endDate: null },
  loop: null,
  recent: [],
  pendingMeasurement: { count: 0, items: [] },
};

function renderAt(path: string) {
  void i18n.changeLanguage('en');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/app/growth/:stage?" element={<GrowthPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GrowthPage', () => {
  it('renders the panel named by the URL stage', async () => {
    stubFetch({ '/dashboard': { body: dashboardBase } });

    renderAt('/app/growth/experiments');

    expect(await screen.findByText('experiments-panel')).toBeInTheDocument();
    expect(screen.queryByText('goals-panel')).not.toBeInTheDocument();
  });

  it('marks the URL stage current on the stepper', async () => {
    stubFetch({ '/dashboard': { body: dashboardBase } });

    renderAt('/app/growth/research');

    await screen.findByText('research-panel');
    expect(screen.getByRole('tab', { name: /Research/i })).toHaveAttribute('aria-current', 'step');
  });

  it('switches panels when a different stage is clicked, without changing route component identity', async () => {
    stubFetch({ '/dashboard': { body: dashboardBase } });
    const user = userEvent.setup();

    renderAt('/app/growth/goals');
    await screen.findByText('goals-panel');

    await user.click(screen.getByRole('tab', { name: /Tests/i }));

    expect(await screen.findByText('experiments-panel')).toBeInTheDocument();
    expect(screen.queryByText('goals-panel')).not.toBeInTheDocument();
  });

  it('redirects /app/growth (no stage) to the first stage with a pendência', async () => {
    stubFetch({
      '/dashboard': {
        body: { ...dashboardBase, setup: { ...dashboardBase.setup, strategy: false, experiment: false } },
      },
    });

    renderAt('/app/growth');

    // goal and research are done, strategy is not — that is where it lands.
    expect(await screen.findByText('strategies-panel')).toBeInTheDocument();
  });

  it('redirects an unknown stage to goals', async () => {
    stubFetch({ '/dashboard': { body: dashboardBase } });

    renderAt('/app/growth/not-a-real-stage');

    expect(await screen.findByText('goals-panel')).toBeInTheDocument();
  });

  it('offers the "new" toolbar button for a stage that creates something', async () => {
    stubFetch({ '/dashboard': { body: dashboardBase } });

    renderAt('/app/growth/goals');
    await screen.findByText('goals-panel');
    expect(screen.getByRole('link', { name: /New/i })).toHaveAttribute('href', '/app/goals/new');
  });

  it('has no "new" button for learnings — a learning is never created directly', async () => {
    stubFetch({ '/dashboard': { body: dashboardBase } });

    renderAt('/app/growth/learnings');
    await screen.findByText('learnings-panel');
    expect(screen.queryByRole('link', { name: /New/i })).not.toBeInTheDocument();
  });
});
