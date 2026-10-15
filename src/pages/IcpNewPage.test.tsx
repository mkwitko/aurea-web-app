import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { IcpNewPage } from './IcpNewPage';

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
const pricing = { operations: [{ taskType: 'propose-icp', credits: 3 }] };

const emptyContext = { currentVersion: null };

// Three non-empty sections — exactly the threshold `filledSectionCount`
// (and the server's own `precheck`) requires.
const richContext = {
  currentVersion: {
    data: {
      companyProfile: { mission: 'Grow anvils' },
      products: [{ id: '1', name: 'Anvil', description: 'Falls reliably' }],
      marketContext: { tam: 5_000_000 },
    },
  },
};

const run = {
  id: 'run-icp',
  taskType: 'propose-icp',
  agentType: 'growth-strategist',
  status: 'COMPLETED',
  input: { businessId: 'biz-1' },
  output: {
    filled: {
      name: 'Early-stage SaaS founder',
      description: 'Solo founder juggling growth and product',
      painPoints: ['no time to compare vendors'],
      characteristics: ['runs a 5-10 person team'],
      customerGoals: ['ship faster without hiring'],
      buyingTriggers: ['just missed a deadline'],
      objections: ['worried about the migration effort'],
    },
    questions: [],
    confidence: 'MEDIUM',
  },
  error: null,
  model: null,
  createdAt: '2026-07-29T00:00:00.000Z',
  completedAt: '2026-07-29T00:01:00.000Z',
};

/** The three queries every `AiFillButton` mount needs, plus business + context. */
function server(context: unknown, overrides: Record<string, { status?: number; body: unknown }> = {}) {
  return {
    '/business': { body: business },
    '/business/context': { body: context },
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

describe('IcpNewPage — AI fill', () => {
  it('blocks the button with the missing-context message and no button when fewer than three sections are filled', async () => {
    stubFetch(server(emptyContext));

    renderWithProviders(<IcpNewPage />);

    expect(
      await screen.findByText('AUREA needs a bit more recorded context first — at least three sections of your business context.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go fill in your business context' })).toHaveAttribute(
      'href',
      '/app/business',
    );
    expect(screen.queryByRole('button', { name: /Draft this ICP with AI/i })).not.toBeInTheDocument();
  });

  it('offers the button and states its cost once at least three sections are filled', async () => {
    stubFetch(server(richContext));

    renderWithProviders(<IcpNewPage />);

    expect(await screen.findByRole('button', { name: /Draft this ICP with AI/i })).toBeInTheDocument();
    expect(await screen.findByText('costs 3 credit(s)')).toBeInTheDocument();
    expect(screen.queryByText(/needs a bit more recorded context/i)).not.toBeInTheDocument();
  });

  it('writes every field the run filled into the form', async () => {
    stubFetch(server(richContext, { '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-icp': { body: run } }));

    renderWithProviders(<IcpNewPage />);

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Early-stage SaaS founder'));
    expect(screen.getByLabelText(/Description/)).toHaveValue('Solo founder juggling growth and product');
    expect(screen.getByText('no time to compare vendors')).toBeInTheDocument();
    expect(screen.getByText('runs a 5-10 person team')).toBeInTheDocument();
    expect(screen.getByText('ship faster without hiring')).toBeInTheDocument();
    expect(screen.getByText('just missed a deadline')).toBeInTheDocument();
    expect(screen.getByText('worried about the migration effort')).toBeInTheDocument();
  });

  it('sends every AI-filled list alongside the create, not just the ones a founder typed by hand', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        ...server(richContext, { '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-icp': { body: run } }),
        '/icps': { body: { icp: { id: 'icp-9' } } },
      },
      calls,
    );

    renderWithProviders(<IcpNewPage />);

    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Early-stage SaaS founder'));
    await screen.findByText('runs a 5-10 person team');

    await userEvent.click(await screen.findByRole('button', { name: 'Add ICP' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/icps')).toBe(true));
    const created = calls.find((call) => call.method === 'POST' && call.path === '/icps');
    expect(created?.body).toMatchObject({
      name: 'Early-stage SaaS founder',
      characteristics: ['runs a 5-10 person team'],
      customerGoals: ['ship faster without hiring'],
      buyingTriggers: ['just missed a deadline'],
      objections: ['worried about the migration effort'],
    });
  });
});
