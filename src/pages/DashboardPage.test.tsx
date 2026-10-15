import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { AuthProvider } from '@/lib/auth';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { DashboardPage } from './DashboardPage';

const MID_SETUP = {
  setup: { business: true, icp: true, goal: true, research: false, strategy: false, completed: 3, total: 5 },
  stage: 'RESEARCH',
  nextAction: {
    kind: 'RUN_RESEARCH',
    subjectLabel: null,
    experimentId: null,
    learningId: null,
    endDate: null,
  },
  loop: null,
  recent: [],
  pendingMeasurement: { count: 0, items: [] },
};

const IN_LOOP = {
  setup: { business: true, icp: true, goal: true, research: true, strategy: true, completed: 5, total: 5 },
  stage: 'OUTCOME',
  nextAction: {
    kind: 'RECORD_OUTCOME',
    subjectLabel: 'LinkedIn DM test',
    experimentId: 'e1',
    learningId: null,
    endDate: null,
  },
  loop: {
    number: 1,
    goal: { id: 'g1', name: '30 trial signups/mo', metric: 'signups', targetValue: 30, unit: 'signups' },
    strategy: { id: 's1', name: 'founder-led outbound' },
    experiment: { id: 'e1', name: 'LinkedIn DM test', status: 'COMPLETED', metric: 'replies', endDate: null },
    rail: [
      { node: 'STRATEGY', state: 'DONE' },
      { node: 'EXPERIMENT', state: 'DONE' },
      { node: 'OUTCOME', state: 'CURRENT' },
      { node: 'LEARNING', state: 'TODO' },
    ],
  },
  recent: [
    {
      at: '2026-07-27T00:00:00.000Z',
      kind: 'EXPERIMENT_COMPLETED',
      refType: 'EXPERIMENT',
      refId: 'e1',
      label: 'LinkedIn DM test',
      count: null,
      value: null,
      unit: null,
    },
  ],
  pendingMeasurement: { count: 0, items: [] },
};

// Setup reports complete but `loop` is null — the backend derives both from
// one snapshot and pins this cannot happen (a test on that repo asserts it),
// but this file cannot see that invariant, so it must not double-render the
// checklist if the assumption ever breaks.
const SETUP_COMPLETE_NO_LOOP = {
  setup: { business: true, icp: true, goal: true, research: true, strategy: true, completed: 5, total: 5 },
  stage: 'COMPLETE',
  nextAction: {
    kind: 'START_NEXT_LOOP',
    subjectLabel: null,
    experimentId: null,
    learningId: null,
    endDate: null,
  },
  loop: null,
  recent: [],
  pendingMeasurement: { count: 0, items: [] },
};

function renderDashboard() {
  return renderWithProviders(
    <AuthProvider>
      <DashboardPage />
    </AuthProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DashboardPage mid-setup', () => {
  it('shows the checklist and no loop panel', async () => {
    stubFetch({ '/dashboard': { body: MID_SETUP } });

    renderDashboard();

    expect(await screen.findByText('3 / 5')).toBeInTheDocument();
    // loop is null, so there is nothing to describe yet.
    expect(screen.queryByTestId('rail-node')).not.toBeInTheDocument();
  });

  it('names the first missing step as the next action', async () => {
    stubFetch({ '/dashboard': { body: MID_SETUP } });

    renderDashboard();

    expect(await screen.findByText(i18n.t('app.dashboard.next.RUN_RESEARCH'))).toBeInTheDocument();
  });

  it('keeps the setup-flavoured subtitle while setup is unfinished', async () => {
    stubFetch({ '/dashboard': { body: MID_SETUP } });

    renderDashboard();

    expect(await screen.findByText(i18n.t('app.dashboard.subtitle'))).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('app.dashboard.subtitleLoop'))).not.toBeInTheDocument();
  });
});

describe('DashboardPage in the loop', () => {
  it('makes the loop the hero and collapses the checklist', async () => {
    stubFetch({ '/dashboard': { body: IN_LOOP } });

    renderDashboard();

    expect(await screen.findByText(i18n.t('app.dashboard.loopTitle', { number: 1 }))).toBeInTheDocument();
    expect(screen.getAllByTestId('rail-node')).toHaveLength(4);
    expect(screen.getByText(i18n.t('app.dashboard.setupDone', { completed: 5, total: 5 }))).toBeInTheDocument();
    // Collapsed: the step rows are not on screen.
    expect(screen.queryByRole('link', { name: i18n.t('app.dashboard.steps.research.title') })).not.toBeInTheDocument();
  });

  it('shows the next action and the feed', async () => {
    stubFetch({ '/dashboard': { body: IN_LOOP } });

    renderDashboard();

    expect(
      await screen.findByText(i18n.t('app.dashboard.next.RECORD_OUTCOME', { subject: 'LinkedIn DM test' })),
    ).toBeInTheDocument();
    expect(screen.getByTestId('recent-row')).toHaveTextContent('LinkedIn DM test');
  });

  it('swaps to the loop subtitle once a founder is past setup', async () => {
    stubFetch({ '/dashboard': { body: IN_LOOP } });

    renderDashboard();

    expect(await screen.findByText(i18n.t('app.dashboard.subtitleLoop'))).toBeInTheDocument();
    // The pre-setup subtitle would contradict the loop panel rendered right
    // below it, so it must not also be on screen.
    expect(screen.queryByText(i18n.t('app.dashboard.subtitle'))).not.toBeInTheDocument();
  });

  it('issues exactly one request for the whole screen', async () => {
    const calls: { method: string; path: string; body: unknown }[] = [];
    stubFetch({ '/dashboard': { body: IN_LOOP } }, calls);

    renderDashboard();
    await screen.findByText(i18n.t('app.dashboard.loopTitle', { number: 1 }));

    // The point of the backend slice: no fan-out, no waterfall.
    expect(calls.filter((call) => call.path === '/dashboard')).toHaveLength(1);
    expect(calls.every((call) => call.path === '/dashboard')).toBe(true);
  });
});

describe('DashboardPage edge case: setup complete but no loop yet', () => {
  it('renders only the uncollapsed checklist, never both forms at once', async () => {
    stubFetch({ '/dashboard': { body: SETUP_COMPLETE_NO_LOOP } });

    renderDashboard();

    // The uncollapsed hero form is present (its own "5 / 5" progress line)...
    expect(await screen.findByText('5 / 5')).toBeInTheDocument();
    // ...and the collapsed summary row — which only ever accompanies the loop
    // panel — must not also be on screen.
    expect(
      screen.queryByText(i18n.t('app.dashboard.setupDone', { completed: 5, total: 5 })),
    ).not.toBeInTheDocument();
  });
});

describe('DashboardPage failure', () => {
  it('shows an error instead of an empty screen', async () => {
    stubFetch({ '/dashboard': { status: 500, body: { error: { code: 'INTERNAL' } } } });

    renderDashboard();

    expect(await screen.findByText(i18n.t('app.dashboard.error'))).toBeInTheDocument();
  });
});
