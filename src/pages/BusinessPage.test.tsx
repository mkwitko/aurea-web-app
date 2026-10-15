import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { BusinessPage } from './BusinessPage';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const business = {
  business: {
    id: 'biz-1',
    name: 'Acme',
    description: 'We sell anvils',
    website: 'https://acme.test',
    industry: 'Manufacturing',
    businessModel: 'B2B',
    revenueModel: 'Subscription',
    valueProposition: 'Anvils that land',
    positioning: 'Premium',
  },
};

const context = { currentVersion: null };

afterEach(() => {
  navigate.mockClear();
  vi.unstubAllGlobals();
});

/** Opens the destructive dialog and confirms it. */
async function confirmDelete() {
  await userEvent.click(await screen.findByRole('button', { name: 'Delete business' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
}

describe('BusinessPage delete', () => {
  it('deletes the business and leaves the page', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/business': { body: business },
        '/business/context': { body: context },
        '/business/': { body: business },
        // The context card's AiFillButton mounts alongside it and needs all
        // three of its own queries answered.
        '/credits': { body: { plan: 'FREE', allowance: 0, consumed: 0, purchasedBalance: 0, periodStart: null, periodEnd: null } },
        '/credits/pricing': { body: { operations: [] } },
        '/agent-runs': { body: { runs: [] } },
      },
      calls,
    );

    renderWithProviders(<BusinessPage />);
    await confirmDelete();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/app'));
    expect(calls.some((call) => call.method === 'DELETE' && call.path === '/business')).toBe(true);
  });

  it('says so when the delete fails instead of pretending it worked', async () => {
    // The failure path had no coverage and no message: the dialog closed, the
    // business was still there, and nothing on screen said why. Navigating
    // away would be worse — it reads as a successful delete.
    let deleteCalled = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        if ((init?.method ?? 'GET') === 'DELETE') {
          deleteCalled = true;
          return new Response(JSON.stringify({ error: { code: 'AUR-B0003', message: 'Business has active goals' } }), {
            status: 409,
            headers: { 'content-type': 'application/json' },
          });
        }
        // Also stands in for the AiFillButton the context card now renders:
        // an empty allowance/pricing/runs answer, just enough for it to
        // settle instead of leaving its three queries unresolved.
        const bodies: Record<string, unknown> = {
          '/business': business,
          '/business/context': context,
          '/credits': { plan: 'FREE', allowance: 0, consumed: 0, purchasedBalance: 0, periodStart: null, periodEnd: null },
          '/credits/pricing': { operations: [] },
          '/agent-runs': { runs: [] },
        };
        return new Response(JSON.stringify(bodies[path]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    renderWithProviders(<BusinessPage />);
    await confirmDelete();

    expect(await screen.findByText('Business has active goals')).toBeInTheDocument();
    expect(deleteCalled).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });
});

describe('BusinessPage — AI-draft provenance on the section grid', () => {
  // O run de contexto inteiro agora grava as seções sozinho no servidor
  // (applyOutput): a marca por cartão vem do `sectionMeta` do contexto, não
  // de uma proposta pendente colhida via `?fillRun=`.
  const contextWithMeta = {
    currentVersion: {
      id: 'v2',
      version: 2,
      data: { companyProfile: { mission: 'Land anvils' } },
      source: 'AI',
      confidence: 'MEDIUM',
      createdAt: '2026-08-05T00:00:00.000Z',
      completeness: 20,
      incompleteSections: ['products', 'competitive', 'market', 'constraints', 'performance', 'activities', 'projects', 'campaigns'],
      sectionMeta: {
        companyProfile: { source: 'AI', sourceAgentRunId: 'run-whole', confidence: 'MEDIUM' },
        currentPerformance: { source: 'USER' },
      },
    },
  };

  function stubWithMeta() {
    stubFetch({
      '/business': { body: business },
      '/business/context': { body: contextWithMeta },
      '/credits': { body: { plan: 'FREE', allowance: 0, consumed: 0, purchasedBalance: 0, periodStart: null, periodEnd: null } },
      '/credits/pricing': { body: { operations: [{ taskType: 'propose-business-context', credits: 5 }] } },
      '/agent-runs': { body: { runs: [] } },
    });
  }

  it('marks a section the AI wrote and the founder has not confirmed yet', async () => {
    stubWithMeta();

    renderWithProviders(<BusinessPage />);

    const company = (await screen.findByText('Company')).closest('a');
    await waitFor(() => expect(company).toHaveTextContent('AI draft'));
  });

  it('does not mark sections owned by the founder or never proposed', async () => {
    stubWithMeta();

    renderWithProviders(<BusinessPage />);

    await screen.findByText('Company');
    // `currentPerformance` foi salva pelo fundador (source USER): sem marca.
    expect(screen.getByText('Performance').closest('a')).not.toHaveTextContent('AI draft');
    // Nunca proposta: sem marca.
    expect(screen.getByText('Products & Services').closest('a')).not.toHaveTextContent('AI draft');
  });

  it('keeps the section-grid links bare — there is nothing to harvest anymore', async () => {
    stubWithMeta();

    renderWithProviders(<BusinessPage />);

    const company = (await screen.findByText('Company')).closest('a');
    expect(company).toHaveAttribute('href', '/app/business/context/company');
  });

  it('marks nothing when the context carries no sectionMeta', async () => {
    stubFetch({
      '/business': { body: business },
      '/business/context': { body: context },
      '/credits': { body: { plan: 'FREE', allowance: 0, consumed: 0, purchasedBalance: 0, periodStart: null, periodEnd: null } },
      '/credits/pricing': { body: { operations: [] } },
      '/agent-runs': { body: { runs: [] } },
    });

    renderWithProviders(<BusinessPage />);

    await screen.findByText('Company');
    expect(screen.queryByText('AI draft')).not.toBeInTheDocument();
  });
});

describe('BusinessPage — what the AI actually fills', () => {
  function stubGrid() {
    stubFetch({
      '/business': { body: business },
      '/business/context': { body: context },
      '/credits': { body: { plan: 'FREE', allowance: 0, consumed: 0, purchasedBalance: 0, periodStart: null, periodEnd: null } },
      '/credits/pricing': { body: { operations: [{ taskType: 'propose-business-context', credits: 5 }] } },
      '/agent-runs': { body: { runs: [] } },
    });
  }

  // "Fill everything" was a lie: the agent never proposes projects or campaigns,
  // so the button promised nine sections and delivered seven. The count comes
  // from the registry, so a section changing sides cannot leave the copy behind.
  it('names how many sections the bulk fill covers, not how many exist', async () => {
    stubGrid();

    renderWithProviders(<BusinessPage />);

    expect(await screen.findByRole('button', { name: 'Fill 7 sections with AI' })).toBeInTheDocument();
  });

  it('says who fills the two the AI leaves alone, and what a single section costs', async () => {
    stubGrid();

    renderWithProviders(<BusinessPage />);

    expect(await screen.findByText(/Projects and campaigns are internal records/)).toBeInTheDocument();
    expect(screen.getByText(/1 credit each/)).toBeInTheDocument();
  });

  it('marks each section card with whether the AI covers it', async () => {
    stubGrid();

    renderWithProviders(<BusinessPage />);

    // Pelo título e não pelo href: o botão "Continue" acima do grid aponta para
    // a mesma rota da primeira seção pendente, e pegar links por href casava com
    // ele em vez do cartão.
    const company = (await screen.findByText('Company')).closest('a');
    const projects = screen.getByText('Projects').closest('a');

    // A marca visível é a barra azul à esquerda do cartão; o texto abaixo é o
    // mesmo fato para leitor de tela, e é o que dá para afirmar num teste.
    expect(company).toHaveTextContent('filled by the AI');
    expect(company?.className).toContain('border-l-primary');
    expect(projects).toHaveTextContent('you fill this one');
    expect(projects?.className).not.toContain('border-l-primary');
    // Seven sections the AI covers, two the founder is on their own for.
    expect(screen.getAllByText('filled by the AI')).toHaveLength(7);
    expect(screen.getAllByText('you fill this one')).toHaveLength(2);
    // E a legenda que explica a cor, sem depender de hover.
    expect(screen.getByText(/Blue left edge/)).toBeInTheDocument();
  });
});
