import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import i18n from '@/i18n';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { reviewedSections } from '@/lib/reviewed-sections';
import { BusinessContextSectionPage } from './BusinessContextSectionPage';

const business = {
  business: {
    id: 'biz-1',
    name: 'Acme',
    website: 'https://acme.test',
    industry: 'Manufacturing',
    valueProposition: 'Anvils that land',
    positioning: 'Premium',
  },
};

const emptyContext = { currentVersion: null };

const rich = {
  plan: 'GROWTH',
  allowance: 100,
  consumed: 0,
  purchasedBalance: 0,
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-08-01T00:00:00.000Z',
};
const pricing = {
  operations: [
    { taskType: 'propose-business-context', credits: 5 },
    { taskType: 'propose-context-section', credits: 2 },
  ],
};

type Run = {
  id: string;
  taskType: string;
  agentType: string;
  status: string;
  input: unknown;
  output: unknown;
  error: string | null;
  model: string | null;
  createdAt: string;
  completedAt: string | null;
};

function makeRun(overrides: Partial<Run> & Pick<Run, 'id' | 'taskType' | 'input'>): Run {
  return {
    agentType: 'onboarding-analyst',
    status: 'COMPLETED',
    output: null,
    error: null,
    model: null,
    createdAt: '2026-07-29T00:00:00.000Z',
    completedAt: '2026-07-29T00:01:00.000Z',
    ...overrides,
  };
}

/**
 * Renders the page the same way the real router does: `MemoryRouter` +
 * `Routes` so `useParams` and `useSearchParams` both come from the genuine
 * hooks, matching the section and the `?fillRun=` query string in `path`
 * rather than a mocked stand-in for either.
 */
function renderAt(path: string) {
  void i18n.changeLanguage('en');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/app/business/context/:section" element={<BusinessContextSectionPage />} />
            {/* Only reachable via `saveAndGo`'s `navigate('/app/business')` — a
                stand-in so that lands quietly instead of logging "no routes
                matched" from a router with nowhere else to go. */}
            <Route path="/app/business" element={<div>business page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
    queryClient,
  };
}

/** The three queries every AiFillButton mount needs, plus the run when one exists. */
function serverWith(run: Run | null, overrides: Record<string, { status?: number; body: unknown }> = {}) {
  return {
    '/business': { body: business },
    '/business/context': { body: emptyContext },
    '/credits': { body: rich },
    '/credits/pricing': { body: pricing },
    '/agent-runs': { body: { runs: run ? [run] : [] } },
    ...(run ? { [`/agent-runs/${run.id}`]: { body: run } } : {}),
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BusinessContextSectionPage — AI fill', () => {
  it("applies only this section's slice of a whole-context proposal", async () => {
    // The whole-context run fills seven sections at once; landing on the
    // "market" section page with that run's id in `?fillRun=` must apply
    // marketContext only — never bleed companyProfile into it.
    const run = makeRun({
      id: 'run-whole',
      taskType: 'propose-business-context',
      input: { businessId: 'biz-1' },
      output: {
        filled: { companyProfile: { mission: 'Make anvils that land' }, marketContext: { tam: 5_000_000 } },
        questions: [],
        confidence: 'MEDIUM',
      },
    });
    stubFetch(serverWith(run));

    renderAt('/app/business/context/market?fillRun=run-whole');

    // `findByLabelText` alone would resolve the moment the (always-present,
    // still-empty) field mounts — the fill applies later, once the adopted
    // run's poll resolves, so the value itself needs `waitFor`.
    await screen.findByLabelText('TAM ($)');
    // Máscara de milhar: o campo é `type=text` e mostra o valor agrupado na
    // língua da interface (en nos testes). O formulário guarda o número.
    await waitFor(() => expect(screen.getByLabelText('TAM ($)')).toHaveValue('5,000,000'));
  });

  it('assigns an id to every row of an array section before setValue', async () => {
    // The agent never emits an id (by design), and `productsSectionSchema`
    // requires one on every row. Without the client assigning one before
    // `setValue`, saving would fail validation instead of succeeding.
    const run = makeRun({
      id: 'run-products',
      taskType: 'propose-context-section',
      input: { businessId: 'biz-1', section: 'products' },
      output: {
        filled: {
          products: [
            { name: 'Widget', description: 'A thing that works' },
            { name: 'Gadget', description: 'Another thing that works' },
          ],
        },
        questions: [],
        confidence: 'HIGH',
      },
    });
    const calls: StubFetchCall[] = [];
    stubFetch(
      { ...serverWith(run), '/business/context/section': { body: { version: { id: 'v2' } } } },
      calls,
    );

    renderAt('/app/business/context/products');

    expect(await screen.findByDisplayValue('Widget')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Gadget')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save and close' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    const put = calls.find((call) => call.method === 'PUT');
    const sentProducts = (put?.body as { data: { id: string }[] }).data;
    expect(sentProducts).toHaveLength(2);
    expect(sentProducts[0]?.id).toBeTruthy();
    expect(sentProducts[1]?.id).toBeTruthy();
    expect(sentProducts[0]?.id).not.toBe(sentProducts[1]?.id);
  });

  it("an answer from the panel lands in the form at the question's fills path", async () => {
    const run = makeRun({
      id: 'run-performance',
      taskType: 'propose-context-section',
      input: { businessId: 'biz-1', section: 'performance' },
      output: {
        filled: {},
        questions: [
          {
            id: 'q1',
            ask: 'What is your MRR?',
            why: 'It anchors every other metric.',
            answerType: 'currency',
            fills: 'currentPerformance.mrr',
            impact: 3,
          },
        ],
        confidence: 'MEDIUM',
      },
    });
    stubFetch(serverWith(run));

    renderAt('/app/business/context/performance');

    expect(await screen.findByText('What is your MRR?')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Answer'), '45000');
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByLabelText('MRR ($)')).toHaveValue(45_000);
  });

  it('saving after a proposal sends sourceAgentRunId', async () => {
    const run = makeRun({
      id: 'run-market',
      taskType: 'propose-business-context',
      input: { businessId: 'biz-1' },
      output: { filled: { marketContext: { tam: 3_000_000 } }, questions: [], confidence: 'MEDIUM' },
    });
    const calls: StubFetchCall[] = [];
    stubFetch({ ...serverWith(run), '/business/context/section': { body: { version: { id: 'v3' } } } }, calls);

    renderAt('/app/business/context/market?fillRun=run-market');

    await screen.findByLabelText('TAM ($)');
    await waitFor(() => expect(screen.getByLabelText('TAM ($)')).toHaveValue('3,000,000'));

    await userEvent.click(screen.getByRole('button', { name: 'Save and close' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    const put = calls.find((call) => call.method === 'PUT');
    expect((put?.body as { sourceAgentRunId?: string }).sourceAgentRunId).toBe('run-market');
  });

  it('answers a text-typed question into a number field as a number, and saves it', async () => {
    // Run aaee7bac: o modelo pediu `constraints.teamSize` como `text`. A
    // resposta "1" entrava no formulário como string, `z.int()` reprovava, e o
    // Salvar da seção inteira caía — levando embora o orçamento que o fundador
    // tinha respondido na pergunta seguinte.
    const run = makeRun({
      id: 'run-constraints',
      taskType: 'propose-context-section',
      input: { businessId: 'biz-1', section: 'constraints' },
      output: {
        filled: {},
        questions: [
          {
            id: 'q-team',
            ask: 'How many people work here?',
            why: 'Team size bounds what you can execute.',
            answerType: 'text',
            fills: 'constraints.teamSize',
            impact: 3,
          },
        ],
        confidence: 'MEDIUM',
      },
    });
    const calls: StubFetchCall[] = [];
    stubFetch({ ...serverWith(run), '/business/context/section': { body: { version: { id: 'v5' } } } }, calls);

    renderAt('/app/business/context/constraints');

    expect(await screen.findByText('How many people work here?')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Answer'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(screen.getByLabelText('Total Team Size')).toHaveValue(1);

    await userEvent.click(screen.getByRole('button', { name: 'Save and close' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    const put = calls.find((call) => call.method === 'PUT');
    expect((put?.body as { data: { teamSize?: unknown } }).data.teamSize).toBe(1);
  });

  it('marks the section reviewed after a save, so the business page stops nagging', async () => {
    // Salvar `performance` vazia é uma resposta legítima — o fundador não tem
    // as métricas. O backend segue chamando a seção de incompleta (não ganhou
    // dado), mas a marca de "proposta esperando revisão" tem que sair.
    localStorage.clear();
    const run = makeRun({
      id: 'run-whole',
      taskType: 'propose-business-context',
      input: { businessId: 'biz-1' },
      output: { filled: {}, questions: [], confidence: 'MEDIUM' },
    });
    const calls: StubFetchCall[] = [];
    stubFetch({ ...serverWith(run), '/business/context/section': { body: { version: { id: 'v6' } } } }, calls);

    renderAt('/app/business/context/performance?fillRun=run-whole');

    await userEvent.click(await screen.findByRole('button', { name: 'Save and close' }));

    await waitFor(() => expect(reviewedSections('run-whole')).toEqual(['performance']));
  });

  it('saving without a proposal sends no sourceAgentRunId', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ ...serverWith(null), '/business/context/section': { body: { version: { id: 'v4' } } } }, calls);

    renderAt('/app/business/context/market');

    await screen.findByLabelText('TAM ($)');

    await userEvent.click(screen.getByRole('button', { name: 'Save and close' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    const put = calls.find((call) => call.method === 'PUT');
    expect((put?.body as { sourceAgentRunId?: string }).sourceAgentRunId).toBeUndefined();
  });

  it('stays adopted on the next section after "save and next"', async () => {
    // Regression for Finding 1: without `fillRun` carried into the "save and
    // next" href, and without remounting the button per section, `products`
    // would never see its own slice of this same run.
    const run = makeRun({
      id: 'run-walk',
      taskType: 'propose-business-context',
      input: { businessId: 'biz-1' },
      output: {
        filled: { products: [{ name: 'Widget', description: 'A thing that works' }] },
        questions: [],
        confidence: 'MEDIUM',
      },
    });
    stubFetch({ ...serverWith(run), '/business/context/section': { body: { version: { id: 'v5' } } } });

    renderAt('/app/business/context/company?fillRun=run-walk');

    await userEvent.click(await screen.findByRole('button', { name: 'Save and next' }));

    expect(await screen.findByDisplayValue('Widget')).toBeInTheDocument();
  });

  it('shows only this section\'s questions from a proposal that spans several', async () => {
    // Regression for Finding 2: `propose-business-context`'s questions cover
    // several sections in one array; the market page must offer only the
    // ones it can actually save.
    //
    // The out-of-section question (MRR) carries a HIGHER impact than the
    // in-section one (SAM) on purpose: `AiFillPanel` shows one question at a
    // time, sorted by impact, so an unfiltered panel would show MRR first —
    // making the assertion below (SAM shown, MRR not) fail without the
    // section filter. Equal impacts would let a stable sort put SAM first
    // regardless of filtering, which is exactly why the previous version of
    // this test passed even against the pre-fix source.
    const run = makeRun({
      id: 'run-cross',
      taskType: 'propose-business-context',
      input: { businessId: 'biz-1' },
      output: {
        filled: {},
        questions: [
          {
            id: 'q-market',
            ask: 'What is your SAM?',
            why: 'Sizes the market you can actually reach.',
            answerType: 'currency',
            fills: 'marketContext.sam',
            impact: 2,
          },
          {
            id: 'q-perf',
            ask: 'What is your MRR?',
            why: 'It anchors every other metric.',
            answerType: 'currency',
            fills: 'currentPerformance.mrr',
            impact: 3,
          },
        ],
        confidence: 'MEDIUM',
      },
    });
    stubFetch(serverWith(run));

    renderAt('/app/business/context/market?fillRun=run-cross');

    expect(await screen.findByText('What is your SAM?')).toBeInTheDocument();
    expect(screen.queryByText('What is your MRR?')).not.toBeInTheDocument();
  });

  it('sends sourceAgentRunId when the section was saved after answering a panel question', async () => {
    // Human ruling on Finding 3: answering an AI question marks the run, same
    // as an applied fill does — the AI participated either way.
    const run = makeRun({
      id: 'run-answered',
      taskType: 'propose-context-section',
      input: { businessId: 'biz-1', section: 'performance' },
      output: {
        filled: {},
        questions: [
          {
            id: 'q1',
            ask: 'What is your MRR?',
            why: 'It anchors every other metric.',
            answerType: 'currency',
            fills: 'currentPerformance.mrr',
            impact: 3,
          },
        ],
        confidence: 'MEDIUM',
      },
    });
    const calls: StubFetchCall[] = [];
    stubFetch({ ...serverWith(run), '/business/context/section': { body: { version: { id: 'v6' } } } }, calls);

    renderAt('/app/business/context/performance');

    expect(await screen.findByText('What is your MRR?')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Answer'), '45000');
    await userEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(screen.getByLabelText('MRR ($)')).toHaveValue(45_000);

    await userEvent.click(screen.getByRole('button', { name: 'Save and close' }));

    await waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true));
    const put = calls.find((call) => call.method === 'PUT');
    expect((put?.body as { sourceAgentRunId?: string }).sourceAgentRunId).toBe('run-answered');
  });
});
