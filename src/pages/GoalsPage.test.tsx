import { screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { GoalsPage } from './GoalsPage';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GoalsPage', () => {
  it('renders the page chrome and the goal list panel together', async () => {
    stubFetch({
      '/goals': {
        body: { goals: [{ id: 'g1', name: 'Ten discovery calls', metric: 'discovery_calls_booked', status: 'ACTIVE', targetValue: 10, unit: null }] },
      },
    });

    renderWithProviders(<GoalsPage />);

    // Page chrome: PageHeader title + the "new goal" link this wrapper still
    // owns (GrowthPage renders an equivalent button of its own).
    expect(screen.getByRole('heading', { name: 'Goals' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New/i })).toHaveAttribute('href', '/app/goals/new');

    // Panel content, delegated to GoalsPanel.
    expect(await screen.findByText('Ten discovery calls')).toBeInTheDocument();
  });
});
