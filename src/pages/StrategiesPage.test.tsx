import { screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { StrategiesPage } from './StrategiesPage';

const base = {
  '/goals': { body: { goals: [{ id: 'goal-1', name: 'Ten discovery calls', metric: 'discovery_calls_booked', status: 'ACTIVE' }] } },
  '/credits': {
    body: { plan: 'GROWTH', allowance: 100, consumed: 0, purchasedBalance: 0, periodStart: '2026-07-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z' },
  },
  '/credits/pricing': { body: { operations: [{ taskType: 'propose-strategies', credits: 3 }] } },
  '/agent-runs': { body: { runs: [] } },
  '/strategies': { body: { strategies: [{ id: 's1', name: 'Content-led inbound', status: 'DRAFT', growthMechanism: null }] } },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StrategiesPage', () => {
  it('renders the page chrome, the proposer, and the strategy list panel together', async () => {
    stubFetch(base);

    renderWithProviders(<StrategiesPage />);

    expect(screen.getByRole('heading', { name: 'Plans' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New/i })).toHaveAttribute('href', '/app/strategies/new');

    // StrategiesPanel content: the AI proposer and the list, both delegated.
    expect(await screen.findByRole('button', { name: /propose strategies/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Content-led inbound/ })).toHaveAttribute('href', '/app/strategies/s1');
  });
});
