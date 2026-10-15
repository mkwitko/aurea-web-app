import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { ExperimentsPage } from './ExperimentsPage';

const experiment = {
  id: 'exp-1',
  workspaceId: 'ws-1',
  strategyId: 'str-1',
  hypothesisId: 'hyp-1',
  name: 'Cold email to ops leads',
  description: null,
  objective: 'Book 10 discovery calls',
  channel: 'Email',
  audience: 'Ops leads at 50-200 headcount',
  metric: 'discovery_calls_booked',
  baselineValue: 2,
  targetValue: 10,
  successCriteria: 'At least 8 calls booked in 3 weeks',
  startDate: '2026-08-01T00:00:00.000Z',
  endDate: '2026-08-22T00:00:00.000Z',
  status: 'RUNNING',
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
  completedAt: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExperimentsPage', () => {
  it('lists each experiment with its status and the metric it moves', async () => {
    stubFetch({ '/experiments': { body: { experiments: [experiment] } } });

    renderWithProviders(<ExperimentsPage />);

    expect(await screen.findByText('Cold email to ops leads')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    // The metric is what makes an experiment measurable rather than an
    // activity, so it belongs on the card and not only in the detail view.
    expect(screen.getByText(/discovery_calls_booked/)).toBeInTheDocument();
  });

  it('links each experiment to its own page', async () => {
    stubFetch({ '/experiments': { body: { experiments: [experiment] } } });

    renderWithProviders(<ExperimentsPage />);

    expect(await screen.findByRole('link', { name: /Cold email to ops leads/ })).toHaveAttribute(
      'href',
      '/app/experiments/exp-1',
    );
  });

  it('teaches what an experiment is when there are none yet', async () => {
    // A blank card tells a founder nothing. The empty state has to say what
    // this screen is for and where experiments come from — a hypothesis.
    stubFetch({ '/experiments': { body: { experiments: [] } } });

    renderWithProviders(<ExperimentsPage />);

    expect(await screen.findByText(/No experiments yet/i)).toBeInTheDocument();
    // Not just "hypothesis" anywhere on the page — the term also appears in the
    // header's Help text, so match the hint that says where to go next.
    expect(screen.getByText(/start from a strategy/i)).toBeInTheDocument();
  });

  it('shows the loading state before the list arrives, not an empty one', async () => {
    // An empty list and a list that has not loaded look identical if the
    // loading state is skipped, so "no experiments yet" would flash on every
    // visit for someone who has plenty.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await held;
        return new Response(JSON.stringify({ experiments: [experiment] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    renderWithProviders(<ExperimentsPage />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText(/No experiments yet/i)).not.toBeInTheDocument();

    release();
    expect(await screen.findByText('Cold email to ops leads')).toBeInTheDocument();
  });

  it('offers a retry when the list fails to load', async () => {
    stubFetch({ '/experiments': { status: 500, body: { error: { code: 'INTERNAL', message: 'boom' } } } });

    renderWithProviders(<ExperimentsPage />);

    expect(await screen.findByText('Could not load this section.')).toBeInTheDocument();

    stubFetch({ '/experiments': { body: { experiments: [experiment] } } });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Cold email to ops leads')).toBeInTheDocument();
  });
});
