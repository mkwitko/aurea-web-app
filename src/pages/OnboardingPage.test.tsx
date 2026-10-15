import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { AuthProvider } from '@/lib/auth';
import { useFillRun, type UseFillRun } from '@/components/ai/useFillRun';
import { OnboardingPage } from './OnboardingPage';

await i18n.changeLanguage('en');

// The four chain agents' run/adoption machinery already has its own test
// file (`useFillRun.test.tsx`) and its own network semantics (adoption,
// dedup, cancellation). `OnboardingPage`'s job is orchestration — which
// stage runs when, what it does with a completed run's output, and which
// screen a given combination of server state resolves to — so this mocks
// `useFillRun` itself and drives it directly, the same way the old guide's
// test mocked away each step's own page component instead of re-testing it.
vi.mock('@/components/ai/useFillRun', () => ({ useFillRun: vi.fn() }));
const mockUseFillRun = useFillRun as unknown as Mock;

const ME_OWNER = {
  user: { id: '11111111-1111-1111-1111-111111111111', email: 'a@b.com', name: 'Ana' },
  memberships: [{ organizationId: 'org-1', workspaceId: 'ws-1', role: 'OWNER' }],
};
const ME_VIEWER = {
  user: { id: '11111111-1111-1111-1111-111111111111', email: 'a@b.com', name: 'Ana' },
  memberships: [{ organizationId: 'org-1', workspaceId: 'ws-1', role: 'VIEWER' }],
};

const BIZ = {
  id: 'biz-1',
  workspaceId: 'ws-1',
  name: 'Acme',
  description: null,
  website: 'https://acme.example',
  industry: null,
  businessModel: null,
  revenueModel: null,
  valueProposition: null,
  positioning: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ICP = {
  id: 'icp-1',
  workspaceId: 'ws-1',
  name: 'ICP One',
  description: 'Founders who hate spreadsheets',
  painPoints: [],
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const NONE_DONE_SETUP = {
  business: false, context: false, icp: false, goal: false,
  research: false, strategy: false, hypothesis: false, experiment: false,
  completed: 0, total: 8,
};

const DASHBOARD_BODY = (setup: Record<string, unknown>) => ({
  setup,
  stage: 'BUSINESS',
  nextAction: { kind: 'SET_UP_BUSINESS', subjectLabel: null, experimentId: null, learningId: null, endDate: null },
  loop: null,
  recent: [],
});

function idleRun(): UseFillRun {
  return {
    state: 'idle',
    runId: null,
    output: null,
    error: null,
    start: vi.fn(),
    isStarting: false,
    startedAt: null,
    isForeign: false,
    isAdopted: false,
    cancel: vi.fn(),
    isCancelling: false,
  };
}

function doneRun(runId: string, output: unknown): UseFillRun {
  return { ...idleRun(), state: 'done', runId, output };
}

/** Every route this page can call, defaulted to "no business yet" — override per test. */
function stubBase(overrides: Record<string, unknown> = {}, calls?: StubFetchCall[]) {
  stubFetch(
    {
      '/auth/me': { body: ME_OWNER },
      '/dashboard': { body: DASHBOARD_BODY(NONE_DONE_SETUP) },
      '/business': { body: { business: null } },
      '/icps': { body: { icps: [] } },
      '/goals': { body: { goals: [] } },
      '/credits': { body: { allowance: 100, consumed: 0, purchasedBalance: 0 } },
      '/credits/pricing': { body: { operations: [] } },
      ...overrides,
    },
    calls,
  );
}

function renderPage() {
  localStorage.setItem('aurea.access', 'token');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/app/onboarding']}>
        <AuthProvider>
          <Routes>
            <Route path="/app" element={<p>left the concierge</p>} />
            <Route path="/app/onboarding" element={<OnboardingPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  mockUseFillRun.mockReset();
});

describe('OnboardingPage — ask-url', () => {
  it('shows the url form when there is no business yet', async () => {
    stubBase();
    mockUseFillRun.mockImplementation(() => idleRun());
    renderPage();
    expect(await screen.findByText('Tell AUREA who you are')).toBeInTheDocument();
  });

  it('creates the business from the name and website on submit', async () => {
    const calls: StubFetchCall[] = [];
    stubBase({ '/business': [{ body: { business: null } }, { body: { business: BIZ } }] }, calls);
    mockUseFillRun.mockImplementation(() => idleRun());
    renderPage();

    await screen.findByText('Tell AUREA who you are');
    await userEvent.type(screen.getByLabelText('Business name'), 'Acme');
    await userEvent.type(screen.getByLabelText('Website'), 'https://acme.example');
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/business')).toBe(true));
    const created = calls.find((c) => c.method === 'POST' && c.path === '/business');
    expect(created?.body).toEqual({ name: 'Acme', website: 'https://acme.example' });
  });
});

describe('OnboardingPage — the automatic chain', () => {
  it('fires the profile agent on arrival and shows its progress', async () => {
    stubBase({ '/business': { body: { business: BIZ } }, '/business/context': { body: { currentVersion: { completeness: 0, data: {} } } } });
    const profile = idleRun();
    mockUseFillRun.mockImplementation(({ taskType }: { taskType: string }) => (taskType === 'propose-business-profile' ? profile : idleRun()));
    renderPage();

    expect(await screen.findByText('AUREA is building your Growth Brain')).toBeInTheDocument();
    expect(screen.getByText('Reading your website and drafting your business profile')).toBeInTheDocument();
    await waitFor(() => expect(profile.start).toHaveBeenCalledTimes(1));
  });

  it('fires the context agent once the profile is done', async () => {
    stubBase({ '/business': { body: { business: BIZ } }, '/business/context': { body: { currentVersion: { completeness: 0, data: {} } } } });
    const context = idleRun();
    mockUseFillRun.mockImplementation(({ taskType }: { taskType: string }) => {
      if (taskType === 'propose-business-profile') return doneRun('run-p', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-business-context') return context;
      return idleRun();
    });
    renderPage();

    expect(await screen.findByText('Researching your market, product and current performance')).toBeInTheDocument();
    await waitFor(() => expect(context.start).toHaveBeenCalledTimes(1));
  });

  it('shows the merged question screen once profile and context are both done', async () => {
    stubBase({ '/business': { body: { business: BIZ } }, '/business/context': { body: { currentVersion: { completeness: 60, data: {} } } } });
    const question = {
      id: 'q1',
      ask: 'What is your MRR?',
      why: 'To size your baseline.',
      answerType: 'currency',
      fills: 'currentPerformance.mrr',
      impact: 3,
    };
    mockUseFillRun.mockImplementation(({ taskType }: { taskType: string }) => {
      if (taskType === 'propose-business-profile') return doneRun('run-p', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-business-context') return doneRun('run-c', { filled: {}, questions: [question], confidence: 'HIGH' });
      return idleRun();
    });
    renderPage();

    expect(await screen.findByText('A few things only you know')).toBeInTheDocument();
    expect(screen.getByText('What is your MRR?')).toBeInTheDocument();
  });

  it('skips the question screen once already marked done, and fires the icp agent', async () => {
    stubBase({ '/business': { body: { business: BIZ } }, '/business/context': { body: { currentVersion: { completeness: 100, data: {} } } } });
    localStorage.setItem('aurea.concierge.questionsDone.biz-1', '1');
    const icp = idleRun();
    mockUseFillRun.mockImplementation(({ taskType }: { taskType: string }) => {
      if (taskType === 'propose-business-profile') return doneRun('run-p', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-business-context') return doneRun('run-c', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-icp') return icp;
      return idleRun();
    });
    renderPage();

    expect(await screen.findByText('Proposing your ideal customer profile')).toBeInTheDocument();
    await waitFor(() => expect(icp.start).toHaveBeenCalledTimes(1));
  });

  it('materializes the icp the moment propose-icp completes, from its proposal', async () => {
    const calls: StubFetchCall[] = [];
    stubBase(
      { '/business': { body: { business: BIZ } }, '/business/context': { body: { currentVersion: { completeness: 100, data: {} } } } },
      calls,
    );
    localStorage.setItem('aurea.concierge.questionsDone.biz-1', '1');
    mockUseFillRun.mockImplementation(({ taskType }: { taskType: string }) => {
      if (taskType === 'propose-business-profile') return doneRun('run-p', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-business-context') return doneRun('run-c', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-icp') {
        return doneRun('run-icp', {
          filled: { name: 'Busy founders', description: 'desc', painPoints: ['no time'] },
          questions: [],
          confidence: 'HIGH',
        });
      }
      return idleRun();
    });
    renderPage();

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/icps')).toBe(true));
    const created = calls.find((c) => c.method === 'POST' && c.path === '/icps');
    expect(created?.body).toMatchObject({ name: 'Busy founders', description: 'desc', painPoints: ['no time'] });
  });

  it('passes the materialized icp id into the goal agent', async () => {
    stubBase({
      '/business': { body: { business: BIZ } },
      '/business/context': { body: { currentVersion: { completeness: 100, data: {} } } },
      '/icps': { body: { icps: [ICP] } },
    });
    mockUseFillRun.mockImplementation(({ taskType }: { taskType: string }) => {
      if (taskType === 'propose-business-profile') return doneRun('run-p', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-business-context') return doneRun('run-c', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-icp') return doneRun('run-icp', { filled: {}, questions: [], confidence: 'HIGH' });
      return idleRun();
    });
    renderPage();

    await screen.findByText('Proposing your first growth goal');
    await waitFor(() => {
      const goalCalls = mockUseFillRun.mock.calls.filter((call) => call[0]?.taskType === 'propose-goal');
      const latest = goalCalls.at(-1);
      expect(latest?.[0]?.input).toEqual({ businessId: 'biz-1', icpId: 'icp-1' });
    });
  });
});

describe('OnboardingPage — review and approve', () => {
  function stubReview(calls?: StubFetchCall[]) {
    stubBase(
      {
        '/business': { body: { business: BIZ } },
        '/business/context': { body: { currentVersion: { completeness: 100, data: {} } } },
        '/icps': { body: { icps: [ICP] } },
        '/goals': [{ body: { goals: [] } }, { body: { goal: { id: 'goal-1', name: 'Grow signups' } } }],
        '/icps/icp-1': { body: { icp: ICP } },
        '/goals/goal-1/activate': { body: { goal: { id: 'goal-1', status: 'ACTIVE' } } },
        '/agent-runs': { body: { id: 'run-research', taskType: 'research-growth-context', status: 'PENDING' } },
      },
      calls,
    );
    mockUseFillRun.mockImplementation(({ taskType }: { taskType: string }) => {
      if (taskType === 'propose-business-profile') return doneRun('run-p', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-business-context') return doneRun('run-c', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-icp') return doneRun('run-icp', { filled: {}, questions: [], confidence: 'HIGH' });
      if (taskType === 'propose-goal') {
        return doneRun('run-goal', {
          filled: { name: 'Grow signups', metric: 'signups', description: 'more signups' },
          questions: [],
          confidence: 'HIGH',
        });
      }
      return idleRun();
    });
  }

  it('renders the four review cards, pre-filled from the proposals', async () => {
    stubReview();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Review and approve' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('ICP One')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Grow signups')).toBeInTheDocument();
  });

  it('approves everything in one batch and lands on the dashboard', async () => {
    const calls: StubFetchCall[] = [];
    stubReview(calls);
    renderPage();

    await screen.findByRole('heading', { name: 'Review and approve' });
    await userEvent.click(screen.getByRole('button', { name: 'Approve everything' }));

    await waitFor(() => expect(screen.getByText('left the concierge')).toBeInTheDocument());

    expect(calls.some((c) => c.method === 'PATCH' && c.path === '/icps/icp-1')).toBe(true);
    expect(calls.some((c) => c.method === 'POST' && c.path === '/goals')).toBe(true);
    expect(calls.some((c) => c.method === 'POST' && c.path === '/goals/goal-1/activate')).toBe(true);
    expect(calls.some((c) => c.method === 'POST' && c.path === '/agent-runs')).toBe(true);
    const researchCall = calls.find((c) => c.method === 'POST' && c.path === '/agent-runs');
    expect(researchCall?.body).toEqual({ taskType: 'research-growth-context', input: { goalId: 'goal-1' } });
  });
});

describe('OnboardingPage — guards', () => {
  it('sends a VIEWER straight to the dashboard, never into the concierge', async () => {
    stubBase({ '/auth/me': { body: ME_VIEWER }, '/business': { body: { business: BIZ } } });
    mockUseFillRun.mockImplementation(() => idleRun());
    renderPage();
    expect(await screen.findByText('left the concierge')).toBeInTheDocument();
  });

  it('sends a workspace whose setup is already done straight to the dashboard', async () => {
    const DONE_SETUP = { ...NONE_DONE_SETUP, business: true, context: true, icp: true, goal: true, research: true, strategy: true, hypothesis: true, experiment: true, completed: 8 };
    stubBase({ '/dashboard': { body: DASHBOARD_BODY(DONE_SETUP) }, '/business': { body: { business: BIZ } } });
    mockUseFillRun.mockImplementation(() => idleRun());
    renderPage();
    expect(await screen.findByText('left the concierge')).toBeInTheDocument();
  });

  it('redirects to the dashboard once an active goal exists and research has started (resume-after-reload)', async () => {
    const RESEARCH_SETUP = { ...NONE_DONE_SETUP, research: true };
    stubBase({
      '/dashboard': { body: DASHBOARD_BODY(RESEARCH_SETUP) },
      '/business': { body: { business: BIZ } },
      '/business/context': { body: { currentVersion: { completeness: 100, data: {} } } },
      '/icps': { body: { icps: [ICP] } },
      '/goals': { body: { goals: [{ status: 'ACTIVE' }] } },
    });
    mockUseFillRun.mockImplementation(() => doneRun('run', { filled: {}, questions: [], confidence: 'HIGH' }));
    renderPage();
    expect(await screen.findByText('left the concierge')).toBeInTheDocument();
  });
});
