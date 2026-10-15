import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { StrategyDetailPage } from './StrategyDetailPage';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'str-1' }) };
});

const strategy = {
  strategy: {
    id: 'str-1',
    name: 'Founder-led outbound',
    objective: 'Reach ops leads without paid spend',
    strategicThesis: 'Warm, specific outreach beats volume at our size',
    growthMechanism: 'Outbound',
    priority: 'HIGH',
    status: 'ACTIVE',
  },
};

const hypothesis = {
  id: 'hyp-1',
  workspaceId: 'ws-1',
  strategyId: 'str-1',
  statement: 'Ops leads reply more to a plain-text first touch',
  rationale: 'Formatted templates read as marketing',
  expectedOutcome: 'Reply rate above 12%',
  targetMetric: 'reply_rate',
  confidence: 'MEDIUM',
  status: 'PROPOSED',
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-07-28T00:00:00.000Z',
};

const draftStrategy = { strategy: { ...strategy.strategy, status: 'DRAFT' } };

const richCredits = {
  plan: 'GROWTH',
  allowance: 100,
  consumed: 0,
  purchasedBalance: 0,
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-08-01T00:00:00.000Z',
};
const pricing = { operations: [{ taskType: 'propose-hypothesis', credits: 2 }] };

/** The three queries every `AiFillButton` mount needs, on top of the page's own. */
function server(
  strategyBody: unknown,
  overrides: Record<string, { status?: number; body: unknown }> = {},
) {
  return {
    '/strategies/str-1': { body: strategyBody },
    '/hypotheses': { body: { hypotheses: [hypothesis] } },
    '/credits': { body: richCredits },
    '/credits/pricing': { body: pricing },
    '/agent-runs': { body: { runs: [] } },
    ...overrides,
  };
}

function makeRun(overrides: { id: string; output: unknown }) {
  return {
    id: overrides.id,
    taskType: 'propose-hypothesis',
    agentType: 'growth-strategist',
    status: 'COMPLETED',
    input: { strategyId: 'str-1' },
    output: overrides.output,
    error: null,
    model: null,
    createdAt: '2026-07-29T00:00:00.000Z',
    completedAt: '2026-07-29T00:01:00.000Z',
  };
}

/** Stateful stand-in so a transition is observable through the refetched list. */
function stubStrategyServer(calls: StubFetchCall[], onPost: Record<string, () => void>, status: () => string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const raw = init?.body;
      calls.push({
        method: init?.method ?? 'GET',
        path,
        body: typeof raw === 'string' ? (JSON.parse(raw) as unknown) : undefined,
      });
      onPost[path]?.();
      // The hypothesis form's own AiFillButton mounts alongside everything
      // else on this page and needs all three of its queries answered — a
      // path this stub does not recognize below must never fall through to
      // the hypotheses-list body, or `useFillRun`'s `latest.data?.runs[0]`
      // reads `runs` off a `{ hypotheses: [...] }` object and throws.
      const body =
        path === '/strategies/str-1'
          ? strategy
          : path === '/credits'
            ? { plan: 'FREE', allowance: 0, consumed: 0, purchasedBalance: 0, periodStart: null, periodEnd: null }
            : path === '/credits/pricing'
              ? { operations: [] }
              : path === '/agent-runs'
                ? { runs: [] }
                : { hypotheses: [{ ...hypothesis, status: status() }] };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('StrategyDetailPage', () => {
  it('shows the strategy and the hypotheses under it', async () => {
    stubFetch({
      '/strategies/str-1': { body: strategy },
      '/hypotheses': { body: { hypotheses: [hypothesis] } },
    });

    renderWithProviders(<StrategyDetailPage />);

    expect(await screen.findByText('Founder-led outbound')).toBeInTheDocument();
    const card = screen.getByText('Ops leads reply more to a plain-text first touch').closest('div[class*="space-y-3"]');
    // Scoped to the hypothesis card: the confidence Select further down the page
    // renders a hidden native <select> whose options carry the same labels, so a
    // page-wide getByText('Medium') is ambiguous by construction.
    expect(card).not.toBeNull();
    // Confidence and status both matter: a HIGH-confidence hypothesis nobody
    // has tested is a different thing from a validated one.
    expect(within(card as HTMLElement).getByText('Proposed')).toBeInTheDocument();
    expect(within(card as HTMLElement).getByText('Medium')).toBeInTheDocument();
  });

  it('asks only for the strategy it is showing', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      { '/strategies/str-1': { body: strategy }, '/hypotheses': { body: { hypotheses: [hypothesis] } } },
      calls,
    );

    renderWithProviders(<StrategyDetailPage />);
    await screen.findByText('Founder-led outbound');

    // Server-side filtering, not client-side: listing every hypothesis in the
    // workspace and filtering here would grow unbounded with the account.
    const list = calls.find((call) => call.path === '/hypotheses');
    expect(list?.method).toBe('GET');
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('strategyId=str-1'))).toBe(true));
  });

  it('adds a hypothesis to this strategy', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      { '/strategies/str-1': { body: strategy }, '/hypotheses': { body: { hypotheses: [hypothesis] } } },
      calls,
    );

    renderWithProviders(<StrategyDetailPage />);

    await userEvent.type(
      await screen.findByLabelText('Statement'),
      'Ops leads open on Tuesday mornings',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add hypothesis' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/hypotheses')).toBe(true));
    const created = calls.find((call) => call.method === 'POST' && call.path === '/hypotheses');
    // The strategy id comes from the page, not from the user: a hypothesis
    // filed under the wrong strategy is invisible where it matters.
    expect(created?.body).toMatchObject({ strategyId: 'str-1', statement: 'Ops leads open on Tuesday mornings' });
  });

  it('offers only the lifecycle moves the hypothesis status allows', async () => {
    stubFetch({
      '/strategies/str-1': { body: strategy },
      '/hypotheses': { body: { hypotheses: [hypothesis] } },
    });

    renderWithProviders(<StrategyDetailPage />);

    // PROPOSED → TESTED | REJECTED. "Propose" would be a dead button.
    expect(await screen.findByRole('button', { name: 'Mark as tested' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Propose' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Validate' })).not.toBeInTheDocument();
  });

  it('moves a hypothesis through its lifecycle and shows the new status', async () => {
    const calls: StubFetchCall[] = [];
    let status = 'PROPOSED';
    stubStrategyServer(
      calls,
      {
        '/hypotheses/hyp-1/tested': () => {
          status = 'TESTED';
        },
      },
      () => status,
    );

    renderWithProviders(<StrategyDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as tested' }));

    await waitFor(() => expect(calls.some((call) => call.path === '/hypotheses/hyp-1/tested')).toBe(true));
    expect(await screen.findByText('Tested')).toBeInTheDocument();
    // TESTED → VALIDATED | REJECTED, so the next move is now on offer.
    expect(screen.getByRole('button', { name: 'Validate' })).toBeInTheDocument();
  });

  it('confirms before rejecting, and reports a refusal instead of pretending', async () => {
    stubFetch({
      '/strategies/str-1': { body: strategy },
      '/hypotheses': { body: { hypotheses: [hypothesis] } },
      '/hypotheses/hyp-1/reject': {
        status: 400,
        body: { error: { code: 'AUR-V0001', message: 'Cannot move hypothesis from VALIDATED to REJECTED' } },
      },
    });

    renderWithProviders(<StrategyDetailPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));

    expect(await screen.findByText('Cannot move hypothesis from VALIDATED to REJECTED')).toBeInTheDocument();
    expect(screen.getByText('Proposed')).toBeInTheDocument();
  });

  it('links a testable hypothesis to the experiment that would test it', async () => {
    stubFetch({
      '/strategies/str-1': { body: strategy },
      '/hypotheses': { body: { hypotheses: [hypothesis] } },
    });

    renderWithProviders(<StrategyDetailPage />);

    expect(await screen.findByRole('link', { name: /Design an experiment/i })).toHaveAttribute(
      'href',
      '/app/experiments/new',
    );
  });
});

describe('StrategyDetailPage — AI fill', () => {
  it('blocks the button until the strategy is approved or active', async () => {
    stubFetch(server(draftStrategy));

    renderWithProviders(<StrategyDetailPage />);

    expect(
      await screen.findByText('This strategy needs to be approved or active before AUREA can draft a hypothesis for it.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Draft this hypothesis with AI/i })).not.toBeInTheDocument();
  });

  it('offers the button and states its cost once the strategy is active', async () => {
    stubFetch(server(strategy));

    renderWithProviders(<StrategyDetailPage />);

    expect(await screen.findByRole('button', { name: /Draft this hypothesis with AI/i })).toBeInTheDocument();
    expect(await screen.findByText('costs 2 credit(s)')).toBeInTheDocument();
  });

  it('writes every field the run filled into the hypothesis form', async () => {
    const run = makeRun({
      id: 'run-hyp',
      output: {
        filled: {
          statement: 'Ops leads open on Tuesday mornings',
          rationale: 'Inboxes are emptiest right after the weekend',
          expectedOutcome: 'Open rate above 40%',
          targetMetric: 'open_rate',
          confidence: 'MEDIUM',
        },
        questions: [],
        confidence: 'MEDIUM',
      },
    });
    stubFetch(server(strategy, { '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-hyp': { body: run } }));

    renderWithProviders(<StrategyDetailPage />);

    await waitFor(() => expect(screen.getByLabelText('Statement')).toHaveValue('Ops leads open on Tuesday mornings'));
    expect(screen.getByLabelText(/^Why you believe it/)).toHaveValue('Inboxes are emptiest right after the weekend');
    expect(screen.getByLabelText(/^Expected outcome/)).toHaveValue('Open rate above 40%');
    // "Metric" is shared with the experiments copy: it is optional (so its
    // label text is really "MetricOptional") and carries a `Help` trigger
    // whose own accessible name also contains "Metric" — anchoring at the
    // start keeps this scoped to the field itself.
    expect(screen.getByLabelText(/^Metric/)).toHaveValue('open_rate');
    expect(screen.getByRole('combobox')).toHaveTextContent('Medium');
  });

  it('sends the AI-filled fields alongside the ones typed by hand', async () => {
    const run = makeRun({
      id: 'run-hyp',
      output: {
        filled: { rationale: 'Inboxes are emptiest right after the weekend', confidence: 'MEDIUM' },
        questions: [],
        confidence: 'MEDIUM',
      },
    });
    const calls: StubFetchCall[] = [];
    stubFetch(
      server(strategy, { '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-hyp': { body: run } }),
      calls,
    );

    renderWithProviders(<StrategyDetailPage />);

    await waitFor(() =>
      expect(screen.getByLabelText(/^Why you believe it/)).toHaveValue('Inboxes are emptiest right after the weekend'),
    );
    await userEvent.type(screen.getByLabelText('Statement'), 'Ops leads open on Tuesday mornings');
    await userEvent.click(screen.getByRole('button', { name: 'Add hypothesis' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/hypotheses')).toBe(true));
    const created = calls.find((call) => call.method === 'POST' && call.path === '/hypotheses');
    expect(created?.body).toMatchObject({
      strategyId: 'str-1',
      statement: 'Ops leads open on Tuesday mornings',
      rationale: 'Inboxes are emptiest right after the weekend',
      confidence: 'MEDIUM',
    });
  });
});
