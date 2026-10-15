import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { ExperimentNewPage } from './ExperimentNewPage';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const hypotheses = {
  hypotheses: [
    {
      id: 'hyp-1',
      workspaceId: 'ws-1',
      strategyId: 'str-1',
      statement: 'Ops leads reply more to a plain-text first touch',
      rationale: null,
      expectedOutcome: null,
      targetMetric: 'reply_rate',
      confidence: 'MEDIUM',
      status: 'PROPOSED',
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z',
    },
    {
      id: 'hyp-2',
      workspaceId: 'ws-1',
      strategyId: 'str-1',
      statement: 'Already settled, nothing left to test',
      rationale: null,
      expectedOutcome: null,
      targetMetric: null,
      confidence: 'HIGH',
      status: 'VALIDATED',
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z',
    },
  ],
};

const richCredits = {
  plan: 'GROWTH',
  allowance: 100,
  consumed: 0,
  purchasedBalance: 0,
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-08-01T00:00:00.000Z',
};
const pricing = { operations: [{ taskType: 'propose-experiment', credits: 2 }] };

/**
 * The three queries every `AiFillButton` mount needs, on top of whatever the
 * test itself stubs. Every test below renders the form (and therefore this
 * button) except the "no hypotheses to test" one, which never gets past the
 * empty state.
 */
function server(overrides: Record<string, { status?: number; body: unknown }>) {
  return {
    '/hypotheses': { body: hypotheses },
    '/credits': { body: richCredits },
    '/credits/pricing': { body: pricing },
    '/agent-runs': { body: { runs: [] } },
    ...overrides,
  };
}

function makeRun(overrides: { id: string; output: unknown }) {
  return {
    id: overrides.id,
    taskType: 'propose-experiment',
    agentType: 'growth-strategist',
    status: 'COMPLETED',
    input: { hypothesisId: 'hyp-1' },
    output: overrides.output,
    error: null,
    model: null,
    createdAt: '2026-07-29T00:00:00.000Z',
    completedAt: '2026-07-29T00:01:00.000Z',
  };
}

afterEach(() => {
  navigate.mockClear();
  vi.unstubAllGlobals();
});

describe('ExperimentNewPage', () => {
  it('only offers hypotheses that are still worth testing', async () => {
    // An experiment exists to test a hypothesis, so offering one that is
    // already VALIDATED or REJECTED invites work with nothing to learn from it.
    stubFetch(server({}));

    renderWithProviders(<ExperimentNewPage />);

    await userEvent.click(await screen.findByRole('combobox'));

    expect(screen.getByRole('option', { name: /plain-text first touch/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Already settled/ })).not.toBeInTheDocument();
  });

  it('sends the hypothesis, name and metric the backend requires', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(server({ '/experiments': { body: { experiment: { id: 'exp-9' } } } }), calls);

    renderWithProviders(<ExperimentNewPage />);

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /plain-text first touch/ }));
    await userEvent.type(screen.getByLabelText(/Name/), 'Plain-text first touch');
    await userEvent.click(screen.getByRole('button', { name: 'Create experiment' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/experiments')).toBe(true));
    const created = calls.find((call) => call.method === 'POST' && call.path === '/experiments');
    // Asserting the body, not merely that a call happened: a create that posts
    // the wrong hypothesis id builds the experiment against the wrong belief.
    expect(created?.body).toMatchObject({
      hypothesisId: 'hyp-1',
      name: 'Plain-text first touch',
      // Pre-filled from the chosen hypothesis's own target metric — propose,
      // don't ask.
      metric: 'reply_rate',
    });
  });

  it('lands on the new experiment so the next step is in reach', async () => {
    stubFetch(server({ '/experiments': { body: { experiment: { id: 'exp-9' } } } }));

    renderWithProviders(<ExperimentNewPage />);

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /plain-text first touch/ }));
    await userEvent.type(screen.getByLabelText(/Name/), 'Plain-text first touch');
    await userEvent.click(screen.getByRole('button', { name: 'Create experiment' }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app/experiments/exp-9'));
  });

  it('refuses to submit without a hypothesis or a metric, before any request', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(server({}), calls);

    renderWithProviders(<ExperimentNewPage />);

    await userEvent.type(await screen.findByLabelText(/Name/), 'Missing its hypothesis');
    await userEvent.click(screen.getByRole('button', { name: 'Create experiment' }));

    // The backend requires all three; failing here rather than sending a
    // request means the user is told which field, not handed a 400.
    await waitFor(() => expect(screen.getAllByText('Required').length).toBeGreaterThan(0));
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('keeps what was typed when the server rejects the create', async () => {
    stubFetch(
      server({
        '/experiments': {
          status: 400,
          body: { error: { code: 'AUR-V0001', message: 'An experiment for that hypothesis is already running' } },
        },
      }),
    );

    renderWithProviders(<ExperimentNewPage />);

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /plain-text first touch/ }));
    await userEvent.type(screen.getByLabelText(/Name/), 'Plain-text first touch');
    await userEvent.click(screen.getByRole('button', { name: 'Create experiment' }));

    expect(await screen.findByText('An experiment for that hypothesis is already running')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toHaveValue('Plain-text first touch');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('says where hypotheses come from when there are none to test', async () => {
    stubFetch({ '/hypotheses': { body: { hypotheses: [] } } });

    renderWithProviders(<ExperimentNewPage />);

    expect(await screen.findByText(/hypothesis first/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create experiment' })).not.toBeInTheDocument();
  });
});

describe('ExperimentNewPage — AI fill', () => {
  it('blocks the button until a hypothesis is chosen, with no button rendered meanwhile', async () => {
    stubFetch(server({}));

    renderWithProviders(<ExperimentNewPage />);

    expect(await screen.findByText('Choose the hypothesis this experiment tests first.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Design this experiment with AI/i })).not.toBeInTheDocument();
  });

  it('offers the button and states its cost once a hypothesis is chosen', async () => {
    stubFetch(server({}));

    renderWithProviders(<ExperimentNewPage />);

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /plain-text first touch/ }));

    expect(await screen.findByRole('button', { name: /Design this experiment with AI/i })).toBeInTheDocument();
    expect(await screen.findByText('costs 2 credit(s)')).toBeInTheDocument();
  });

  it('writes every field the run filled into the form', async () => {
    const run = makeRun({
      id: 'run-exp',
      output: {
        filled: {
          name: 'Plain-text first touch to ops leads',
          metric: 'reply_rate',
          description: 'A/B a plain-text opener against the templated one',
          objective: 'Book 10 discovery calls',
          channel: 'Email',
          audience: 'Ops leads at 50-200 headcount',
          successCriteria: 'At least 8 calls booked in 3 weeks',
        },
        questions: [],
        confidence: 'MEDIUM',
      },
    });
    stubFetch(server({ '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-exp': { body: run } }));

    renderWithProviders(<ExperimentNewPage />);

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /plain-text first touch/ }));

    await waitFor(() => expect(screen.getByLabelText(/Name/)).toHaveValue('Plain-text first touch to ops leads'));
    expect(screen.getByLabelText(/^Description/)).toHaveValue('A/B a plain-text opener against the templated one');
    expect(screen.getByLabelText(/^Objective/)).toHaveValue('Book 10 discovery calls');
    expect(screen.getByLabelText(/^Channel/)).toHaveValue('Email');
    expect(screen.getByLabelText(/^Audience/)).toHaveValue('Ops leads at 50-200 headcount');
    expect(screen.getByLabelText(/^Success criteria/)).toHaveValue('At least 8 calls booked in 3 weeks');
  });

  it("writes numeric answers to the baseline and target fields at the question's fills path", async () => {
    const run = makeRun({
      id: 'run-baseline',
      output: {
        filled: {},
        questions: [
          {
            id: 'q1',
            ask: 'Where does the metric stand today?',
            why: 'Without a baseline there is nothing to compare the result against.',
            answerType: 'percent',
            fills: 'baselineValue',
            impact: 3,
          },
        ],
        confidence: 'MEDIUM',
      },
    });
    stubFetch(server({ '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-baseline': { body: run } }));

    renderWithProviders(<ExperimentNewPage />);

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /plain-text first touch/ }));

    expect(await screen.findByText('Where does the metric stand today?')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Answer'), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByLabelText(/^Baseline/)).toHaveValue(4);
  });

  it("writes a date answer to the start date field at the question's fills path", async () => {
    const run = makeRun({
      id: 'run-start',
      output: {
        filled: {},
        questions: [
          {
            id: 'q1',
            ask: 'When does it start?',
            why: 'A test with no start date never actually begins.',
            answerType: 'text',
            fills: 'startDate',
            impact: 3,
          },
        ],
        confidence: 'MEDIUM',
      },
    });
    stubFetch(server({ '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-start': { body: run } }));

    renderWithProviders(<ExperimentNewPage />);

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /plain-text first touch/ }));

    expect(await screen.findByText('When does it start?')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Answer'), '2026-08-01');
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByLabelText(/^Start date/)).toHaveValue('2026-08-01');
  });

  it('sends the AI-filled and AI-answered values alongside the create', async () => {
    const run = makeRun({
      id: 'run-exp',
      output: {
        filled: { description: 'A/B a plain-text opener', channel: 'Email' },
        questions: [],
        confidence: 'MEDIUM',
      },
    });
    const calls: StubFetchCall[] = [];
    stubFetch(
      server({
        '/agent-runs': { body: { runs: [run] } },
        '/agent-runs/run-exp': { body: run },
        '/experiments': { body: { experiment: { id: 'exp-9' } } },
      }),
      calls,
    );

    renderWithProviders(<ExperimentNewPage />);

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(screen.getByRole('option', { name: /plain-text first touch/ }));
    await waitFor(() => expect(screen.getByLabelText(/^Description/)).toHaveValue('A/B a plain-text opener'));
    await userEvent.type(screen.getByLabelText(/Name/), 'Plain-text first touch');

    await userEvent.click(screen.getByRole('button', { name: 'Create experiment' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/experiments')).toBe(true));
    const created = calls.find((call) => call.method === 'POST' && call.path === '/experiments');
    expect(created?.body).toMatchObject({
      hypothesisId: 'hyp-1',
      name: 'Plain-text first touch',
      description: 'A/B a plain-text opener',
      channel: 'Email',
    });
  });
});
