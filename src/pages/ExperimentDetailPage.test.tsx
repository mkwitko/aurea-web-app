import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { ExperimentDetailPage } from './ExperimentDetailPage';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'exp-1' }) };
});

const experiment = {
  id: 'exp-1',
  workspaceId: 'ws-1',
  strategyId: 'str-1',
  hypothesisId: 'hyp-1',
  name: 'Cold email to ops leads',
  description: 'Three-touch sequence, no discounts',
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


const outcome = {
  id: 'out-1',
  workspaceId: 'ws-1',
  experimentId: 'exp-1',
  metric: 'discovery_calls_booked',
  value: 9,
  unit: 'calls',
  observedAt: '2026-08-20T12:00:00.000Z',
  source: 'USER',
  createdAt: '2026-08-20T12:00:00.000Z',
  updatedAt: '2026-08-20T12:00:00.000Z',
  // Computed server-side against the experiment's baseline and target.
  comparison: { delta: 3, deltaPct: 50, progressPct: 90 },
};

const learning = {
  id: 'lrn-1',
  workspaceId: 'ws-1',
  experimentId: 'exp-1',
  title: 'Ops leads reply to plain text',
  statement: 'Plain-text first touches booked 9 calls; the templated ones booked none.',
  evidence: null,
  confidence: 'MEDIUM',
  status: 'CANDIDATE',
  createdAt: '2026-08-21T12:00:00.000Z',
  validatedAt: null,
  archivedAt: null,
};

/**
 * A tiny stateful stand-in for the experiments API: the GET reflects whatever
 * the transitions have done so far, so a test can tell "the page re-read the
 * server" apart from "the page painted what the button implied".
 */
function stubExperimentServer(
  calls: StubFetchCall[],
  transitions: Record<string, () => void>,
  currentStatus: () => string,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      calls.push({ method: init?.method ?? 'GET', path, body: undefined });
      transitions[path]?.();
      // The page now reads its measurements too, and that route answers with a
      // different shape — a stub that returned the experiment for everything
      // would break the section rather than the assertion under test. The
      // interpretation panel's recovery read (`/agent-runs`) joins the same
      // list: an empty run history is enough here, since none of these tests
      // assert anything about the panel's contents. OutcomesSection also reads
      // the credit price and balance to show the cost before recording — the
      // shapes below just need to exist so `.operations.find(...)` has an
      // array to search, not the fallback `{ experiment }` body. The page also
      // mounts MetricBindingCard, which reads the metric binding and the
      // connected sources — `{ experiment }` for those would leave
      // `integrations.data.integrations` undefined and crash the render.
      // No binding on record: the real route answers 404, not `{ binding: null }`.
      if (path.endsWith('/metric-binding')) {
        return new Response(JSON.stringify({ error: { code: 'AUR-T0005' } }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }
      const body = path.endsWith('/outcomes')
        ? { outcomes: [] }
        : path === '/learnings'
          ? { learnings: [] }
          : path === '/agent-runs'
            ? { runs: [] }
            : path === '/credits'
              ? { allowance: 100, consumed: 0, purchasedBalance: 0 }
              : path === '/credits/pricing'
                ? { operations: [{ taskType: 'interpret-outcome', credits: 2 }] }
                : path === '/integrations'
                  ? { integrations: [] }
                  : { experiment: { ...experiment, status: currentStatus() } };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExperimentDetailPage', () => {
  it('shows what the experiment is actually testing', async () => {
    stubFetch({
      '/experiments/exp-1': { body: { experiment } },
      '/experiments/exp-1/outcomes': { body: { outcomes: [] } },
      '/learnings': { body: { learnings: [] } },
      '/agent-runs': { body: { runs: [] } },
    });

    renderWithProviders(<ExperimentDetailPage />);

    expect(await screen.findByText('Cold email to ops leads')).toBeInTheDocument();
    expect(screen.getByText('Book 10 discovery calls')).toBeInTheDocument();
    expect(screen.getByText('Ops leads at 50-200 headcount')).toBeInTheDocument();
    // Baseline → target is the whole point: a target with no baseline cannot be
    // read as progress.
    expect(screen.getByText(/discovery_calls_booked/)).toBeInTheDocument();
    expect(screen.getByText(/^2$/)).toBeInTheDocument();
    expect(screen.getByText(/^10$/)).toBeInTheDocument();
    expect(screen.getByText('At least 8 calls booked in 3 weeks')).toBeInTheDocument();
  });

  it('offers only the moves the current status allows', async () => {
    stubFetch({
      '/experiments/exp-1': { body: { experiment } },
      '/experiments/exp-1/outcomes': { body: { outcomes: [] } },
      '/learnings': { body: { learnings: [] } },
      '/agent-runs': { body: { runs: [] } },
    });

    renderWithProviders(<ExperimentDetailPage />);

    // RUNNING → PAUSED | COMPLETED | CANCELLED, and nothing else. Approving a
    // running experiment is exactly the dead button the mirror exists to avoid.
    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel experiment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
  });

  it('performs a transition against the route that move belongs to', async () => {
    // Stateful on purpose: a route map that keeps answering the GET with the
    // original status could never show whether the page re-read the server,
    // which is the actual requirement — the page must not paint the status from
    // the button that was pressed.
    const calls: StubFetchCall[] = [];
    let status = 'RUNNING';
    stubExperimentServer(calls, {
      '/experiments/exp-1/pause': () => {
        status = 'PAUSED';
      },
    }, () => status);

    renderWithProviders(<ExperimentDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pause' }));

    await waitFor(() => expect(calls.some((call) => call.path === '/experiments/exp-1/pause')).toBe(true));
    expect(await screen.findByText('Paused')).toBeInTheDocument();
  });

  it('keeps the status and explains itself when the server refuses the move', async () => {
    // The mirror can be stale — someone else may have completed this
    // experiment in another tab — and the server is the one that decides. A
    // refused transition must not leave the UI claiming it happened.
    stubFetch({
      '/experiments/exp-1': { body: { experiment } },
      '/experiments/exp-1/outcomes': { body: { outcomes: [] } },
      '/learnings': { body: { learnings: [] } },
      '/agent-runs': { body: { runs: [] } },
      '/experiments/exp-1/pause': {
        status: 400,
        body: { error: { code: 'AUR-V0001', message: 'Cannot move experiment from COMPLETED to PAUSED' } },
      },
    });

    renderWithProviders(<ExperimentDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pause' }));

    expect(await screen.findByText('Cannot move experiment from COMPLETED to PAUSED')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
  });

  it('locks the actions while a move is in flight', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: StubFetchCall[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        calls.push({ method: init?.method ?? 'GET', path, body: undefined });
        if (path.endsWith('/pause')) await held;
        if (path === '/learnings') {
          return new Response(JSON.stringify({ learnings: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (path.endsWith('/outcomes')) {
          return new Response(JSON.stringify({ outcomes: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (path === '/agent-runs') {
          return new Response(JSON.stringify({ runs: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (path === '/credits') {
          return new Response(JSON.stringify({ allowance: 100, consumed: 0, purchasedBalance: 0 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (path === '/credits/pricing') {
          return new Response(JSON.stringify({ operations: [{ taskType: 'interpret-outcome', credits: 2 }] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        // MetricBindingCard reads these two: no binding on record, no source
        // connected. Neither is what this test is about.
        if (path.endsWith('/metric-binding')) {
          return new Response(JSON.stringify({ error: { code: 'AUR-T0005' } }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (path === '/integrations') {
          return new Response(JSON.stringify({ integrations: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        const body = path.endsWith('/pause') ? { experiment: { ...experiment, status: 'PAUSED' } } : { experiment };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );

    renderWithProviders(<ExperimentDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Pause' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete' })).toBeDisabled());
    await userEvent.click(screen.getByRole('button', { name: 'Complete' }));
    expect(calls.filter((call) => call.path.endsWith('/complete'))).toHaveLength(0);

    release();
  });

  it('asks for the measurement once the experiment is finished', async () => {
    // Completing used to be a dead end, which is exactly the half of the loop
    // the MVP exists to prove — a finished experiment with no number produced
    // nothing to learn from.
    stubFetch({
      '/experiments/exp-1': { body: { experiment: { ...experiment, status: 'COMPLETED' } } },
      '/experiments/exp-1/outcomes': { body: { outcomes: [] } },
      '/learnings': { body: { learnings: [] } },
      '/agent-runs': { body: { runs: [] } },
    });

    renderWithProviders(<ExperimentDetailPage />);

    expect(await screen.findByText(/record what it measured/i)).toBeInTheDocument();
    expect(screen.queryByText(/what it taught you/i)).not.toBeInTheDocument();
  });

  it('asks what was learned once there is a measurement', async () => {
    stubFetch({
      '/experiments/exp-1': { body: { experiment: { ...experiment, status: 'COMPLETED' } } },
      '/experiments/exp-1/outcomes': { body: { outcomes: [outcome] } },
      '/learnings': { body: { learnings: [] } },
      '/agent-runs': { body: { runs: [] } },
    });

    renderWithProviders(<ExperimentDetailPage />);

    expect(await screen.findByText(/what it taught you/i)).toBeInTheDocument();
    expect(screen.queryByText(/record what it measured/i)).not.toBeInTheDocument();
  });

  it('stops prompting once the loop has been closed', async () => {
    stubFetch({
      '/experiments/exp-1': { body: { experiment: { ...experiment, status: 'COMPLETED' } } },
      '/experiments/exp-1/outcomes': { body: { outcomes: [outcome] } },
      '/learnings': { body: { learnings: [learning] } },
      '/agent-runs': { body: { runs: [] } },
    });

    renderWithProviders(<ExperimentDetailPage />);

    expect(await screen.findByText('Ops leads reply to plain text')).toBeInTheDocument();
    expect(screen.queryByText(/what it taught you/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/record what it measured/i)).not.toBeInTheDocument();
  });

  it('does not ask for a measurement while the experiment is still running', async () => {
    // Nothing has been measured because nothing has finished. Asking here would
    // read as "you are late" for an experiment doing exactly what it should.
    stubFetch({
      '/experiments/exp-1': { body: { experiment } },
      '/experiments/exp-1/outcomes': { body: { outcomes: [] } },
      '/learnings': { body: { learnings: [] } },
      '/agent-runs': { body: { runs: [] } },
    });

    renderWithProviders(<ExperimentDetailPage />);

    expect(await screen.findByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.queryByText(/record what it measured/i)).not.toBeInTheDocument();
  });

  it('confirms before cancelling, because there is no way back', async () => {
    const calls: StubFetchCall[] = [];
    let status = 'RUNNING';
    stubExperimentServer(calls, {
      '/experiments/exp-1/cancel': () => {
        status = 'CANCELLED';
      },
    }, () => status);

    renderWithProviders(<ExperimentDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel experiment' }));

    expect(calls.some((call) => call.path.endsWith('/cancel'))).toBe(false);

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel experiment' }));

    await waitFor(() => expect(calls.some((call) => call.path === '/experiments/exp-1/cancel')).toBe(true));
    // Terminal: the action bar goes away entirely once it is cancelled.
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel experiment' })).not.toBeInTheDocument();
  });

  it('offers the interpretation above the learnings form for a completed experiment with an outcome', async () => {
    // Reuse this file's existing stub map; the panel adds one /agent-runs read.
    // `runs: []` is enough — recovery only adopts a run whose own recorded
    // `input.experimentId` matches this experiment, and there are none.
    stubFetch({
      '/experiments/exp-1': { body: { experiment: { ...experiment, status: 'COMPLETED' } } },
      '/experiments/exp-1/outcomes': { body: { outcomes: [outcome] } },
      '/learnings': { body: { learnings: [] } },
      '/agent-runs': { body: { runs: [] } },
    });

    renderWithProviders(<ExperimentDetailPage />);

    expect(await screen.findByText(i18n.t('pages.experiments.interpret.title'))).toBeInTheDocument();
  });

  it('tells the founder what is missing when the experiment cannot be read yet', async () => {
    // RUNNING (not yet completed) is enough on its own to make `canRun` false —
    // no outcome is needed to prove the "not ready" branch.
    stubFetch({
      '/experiments/exp-1': { body: { experiment } },
      '/experiments/exp-1/outcomes': { body: { outcomes: [] } },
      '/learnings': { body: { learnings: [] } },
      '/agent-runs': { body: { runs: [] } },
    });

    renderWithProviders(<ExperimentDetailPage />);

    expect(await screen.findByText(i18n.t('pages.experiments.interpret.notReady'))).toBeInTheDocument();
  });
});
