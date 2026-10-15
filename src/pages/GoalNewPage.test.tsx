import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { GoalNewPage } from './GoalNewPage';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const business = { business: { id: 'biz-1', name: 'Acme' } };

const richCredits = {
  plan: 'GROWTH',
  allowance: 100,
  consumed: 0,
  purchasedBalance: 0,
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-08-01T00:00:00.000Z',
};
const pricing = { operations: [{ taskType: 'propose-goal', credits: 4 }] };

const noActiveIcps = { icps: [{ id: 'icp-archived', workspaceId: 'ws-1', name: 'Old ICP', status: 'ARCHIVED' }] };
const withActiveIcp = {
  icps: [
    { id: 'icp-archived', workspaceId: 'ws-1', name: 'Old ICP', status: 'ARCHIVED' },
    { id: 'icp-1', workspaceId: 'ws-1', name: 'Early-stage SaaS founder', status: 'ACTIVE' },
  ],
};

function makeRun(overrides: { id: string; output: unknown }) {
  return {
    id: overrides.id,
    taskType: 'propose-goal',
    agentType: 'growth-strategist',
    status: 'COMPLETED',
    input: { businessId: 'biz-1', icpId: 'icp-1' },
    output: overrides.output,
    error: null,
    model: null,
    createdAt: '2026-07-29T00:00:00.000Z',
    completedAt: '2026-07-29T00:01:00.000Z',
  };
}

/** The three queries every `AiFillButton` mount needs, plus business + ICPs. */
function server(icps: unknown, overrides: Record<string, { status?: number; body: unknown }> = {}) {
  return {
    '/business': { body: business },
    '/icps': { body: icps },
    '/credits': { body: richCredits },
    '/credits/pricing': { body: pricing },
    '/agent-runs': { body: { runs: [] } },
    ...overrides,
  };
}

afterEach(() => {
  navigate.mockClear();
  vi.unstubAllGlobals();
});

describe('GoalNewPage — AI fill', () => {
  it('blocks the button with the missing-ICP message and a link to create one, when there is no active ICP', async () => {
    stubFetch(server(noActiveIcps));

    renderWithProviders(<GoalNewPage />);

    expect(await screen.findByText('AUREA needs an active ICP to draft a goal against.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go create an ICP' })).toHaveAttribute('href', '/app/icps/new');
    expect(screen.queryByRole('button', { name: /Draft this goal with AI/i })).not.toBeInTheDocument();
  });

  it('offers the button and states its cost once an active ICP exists', async () => {
    stubFetch(server(withActiveIcp));

    renderWithProviders(<GoalNewPage />);

    expect(await screen.findByRole('button', { name: /Draft this goal with AI/i })).toBeInTheDocument();
    expect(await screen.findByText('costs 4 credit(s)')).toBeInTheDocument();
  });

  it('writes every field the run filled into the form', async () => {
    const run = makeRun({
      id: 'run-goal',
      output: {
        filled: {
          name: '1,000 qualified leads/month',
          description: 'Grow inbound demand from the new ICP',
          metric: 'qualified_leads',
          unit: 'leads',
          baselineValue: 120,
          priority: 'HIGH',
        },
        questions: [],
        confidence: 'MEDIUM',
      },
    });
    stubFetch(server(withActiveIcp, { '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-goal': { body: run } }));

    renderWithProviders(<GoalNewPage />);

    // Exact/anchored matchers throughout: several of these fields also carry
    // a `Help` trigger whose own accessible name is "Explain: <the field's
    // help title>" (e.g. "Explain: Metric", "Explain: Baseline") — a loose
    // substring match against the bare word would resolve to both that
    // trigger and the field itself.
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('1,000 qualified leads/month'));
    expect(screen.getByLabelText(/^Description/)).toHaveValue('Grow inbound demand from the new ICP');
    expect(screen.getByLabelText('Metric')).toHaveValue('qualified_leads');
    expect(screen.getByLabelText(/^Unit/)).toHaveValue('leads');
    expect(screen.getByLabelText(/^Baseline/)).toHaveValue(120);
    // Not `getByText`: Radix's `Select` keeps an offscreen copy of the chosen
    // item's text around (for width measurement), so "High" always matches
    // twice once a value is set — the priority `SelectField` is the only
    // combobox on this page, so scoping to its role is unambiguous.
    expect(screen.getByRole('combobox')).toHaveTextContent('High');
  });

  it("writes a numeric answer to the target field at the question's fills path", async () => {
    const run = makeRun({
      id: 'run-target',
      output: {
        filled: {},
        questions: [
          {
            id: 'q1',
            ask: 'What number are you aiming for?',
            why: 'Where you want to get to is yours to say.',
            answerType: 'number',
            fills: 'targetValue',
            impact: 3,
          },
        ],
        confidence: 'MEDIUM',
      },
    });
    stubFetch(
      server(withActiveIcp, { '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-target': { body: run } }),
    );

    renderWithProviders(<GoalNewPage />);

    expect(await screen.findByText('What number are you aiming for?')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Answer'), '2000');
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByLabelText(/^Target/)).toHaveValue(2000);
  });

  it("writes a date answer to the deadline field at the question's fills path", async () => {
    const run = makeRun({
      id: 'run-deadline',
      output: {
        filled: {},
        questions: [
          {
            id: 'q1',
            ask: 'By when?',
            why: 'A goal with no deadline never comes due.',
            answerType: 'text',
            fills: 'deadline',
            impact: 3,
          },
        ],
        confidence: 'MEDIUM',
      },
    });
    stubFetch(
      server(withActiveIcp, { '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-deadline': { body: run } }),
    );

    renderWithProviders(<GoalNewPage />);

    expect(await screen.findByText('By when?')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Answer'), '2026-12-31');
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByLabelText(/^Deadline/)).toHaveValue('2026-12-31');
  });

  it('sends the AI-filled and AI-answered values alongside the ones typed by hand', async () => {
    const run = makeRun({
      id: 'run-goal',
      output: {
        filled: { metric: 'qualified_leads', baselineValue: 120, priority: 'HIGH' },
        questions: [],
        confidence: 'MEDIUM',
      },
    });
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        ...server(withActiveIcp, { '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-goal': { body: run } }),
        '/goals': { body: { goal: { id: 'goal-9' } } },
      },
      calls,
    );

    renderWithProviders(<GoalNewPage />);

    await waitFor(() => expect(screen.getByLabelText('Metric')).toHaveValue('qualified_leads'));
    await userEvent.type(screen.getByLabelText('Name'), '1,000 qualified leads/month');

    await userEvent.click(screen.getByRole('button', { name: 'Create goal' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/goals')).toBe(true));
    const created = calls.find((call) => call.method === 'POST' && call.path === '/goals');
    expect(created?.body).toMatchObject({
      name: '1,000 qualified leads/month',
      metric: 'qualified_leads',
      baselineValue: 120,
      priority: 'HIGH',
    });
  });
});
