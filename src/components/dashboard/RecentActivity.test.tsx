import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { RecentActivity, type DashboardRecentItem } from './RecentActivity';

function item(overrides: Partial<DashboardRecentItem> = {}): DashboardRecentItem {
  return {
    at: '2026-07-28T00:00:00.000Z',
    kind: 'GOAL_SET',
    refType: 'GOAL',
    refId: 'g1',
    label: '30 trial signups/mo',
    count: null,
    value: null,
    unit: null,
    ...overrides,
  };
}

describe('RecentActivity', () => {
  it('says so when nothing has happened yet', () => {
    renderWithProviders(<RecentActivity items={[]} />);

    expect(screen.getByText(i18n.t('app.dashboard.recentEmpty'))).toBeInTheDocument();
  });

  it('renders one row per item, in the order given', () => {
    renderWithProviders(
      <RecentActivity
        items={[
          item({ kind: 'LEARNING_VALIDATED', refType: 'LEARNING', refId: 'l1', label: 'personalization wins' }),
          item(),
        ]}
      />,
    );

    // The server already sorted them newest-first; the component must not
    // reorder and must not sort by kind.
    const rows = screen.getAllByTestId('recent-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('personalization wins');
  });

  it('pluralizes the research findings count', () => {
    renderWithProviders(
      <RecentActivity
        items={[
          item({ kind: 'RESEARCH_COMPLETED', refType: 'AGENT_RUN', refId: 'r1', label: '', count: 6 }),
          item({ kind: 'RESEARCH_COMPLETED', refType: 'AGENT_RUN', refId: 'r2', label: '', count: 1 }),
        ]}
      />,
    );

    expect(screen.getByText(i18n.t('app.dashboard.recent.RESEARCH_COMPLETED', { count: 6 }))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('app.dashboard.recent.RESEARCH_COMPLETED', { count: 1 }))).toBeInTheDocument();
  });

  it('says the research completed, not that it found zero, when the count is unreadable', () => {
    renderWithProviders(
      <RecentActivity
        items={[item({ kind: 'RESEARCH_COMPLETED', refType: 'AGENT_RUN', refId: 'r1', label: '', count: null })]}
      />,
    );

    expect(screen.getByText(i18n.t('app.dashboard.recent.RESEARCH_COMPLETED_unknown'))).toBeInTheDocument();
    // Neither plural form (which would print "0") may show up instead.
    expect(screen.queryByText(i18n.t('app.dashboard.recent.RESEARCH_COMPLETED', { count: 0 }))).not.toBeInTheDocument();
  });

  it('renders an outcome with its value and unit', () => {
    renderWithProviders(
      <RecentActivity
        items={[item({ kind: 'OUTCOME_RECORDED', refType: 'OUTCOME', refId: 'o1', label: 'replies', value: 18, unit: 'replies' })]}
      />,
    );

    expect(
      screen.getByText(
        i18n.t('app.dashboard.recent.OUTCOME_RECORDED', { label: 'replies', value: 18, unit: 'replies' }),
      ),
    ).toBeInTheDocument();
  });

  it('renders an outcome with no unit without printing "null"', () => {
    renderWithProviders(
      <RecentActivity
        items={[item({ kind: 'OUTCOME_RECORDED', refType: 'OUTCOME', refId: 'o1', label: 'replies', value: 18, unit: null })]}
      />,
    );

    expect(screen.getByTestId('recent-row')).not.toHaveTextContent('null');
  });

  it('links each row at the route for its ref type', () => {
    renderWithProviders(
      <RecentActivity items={[item({ kind: 'STRATEGY_ACCEPTED', refType: 'STRATEGY', refId: 's1', label: 'outbound' })]} />,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '/app/strategies/s1');
  });

  it.each([
    'GOAL_SET',
    'RESEARCH_COMPLETED',
    'STRATEGY_ACCEPTED',
    'STRATEGY_CREATED',
    'EXPERIMENT_CREATED',
    'EXPERIMENT_COMPLETED',
    'OUTCOME_RECORDED',
    'LEARNING_CREATED',
    'LEARNING_VALIDATED',
  ] as const)('renders %s without falling back to a raw key', (kind) => {
    renderWithProviders(<RecentActivity items={[item({ kind, count: 2, value: 1, unit: 'x' })]} />);

    const row = screen.getByTestId('recent-row');
    expect(row.textContent).not.toContain('app.dashboard.recent');
  });
});
