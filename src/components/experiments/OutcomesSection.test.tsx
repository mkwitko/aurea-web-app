import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { OutcomesSection } from './OutcomesSection';

const outcome = {
  id: 'out-1',
  workspaceId: 'ws-1',
  experimentId: 'exp-1',
  metric: 'discovery_calls_booked',
  value: 9,
  unit: 'calls',
  observedAt: '2026-08-20T12:00:00.000Z',
  source: 'USER',
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-20T00:00:00.000Z',
  // Computed server-side against the experiment's baseline and target: 9 from a
  // baseline of 6 towards a target of 10.
  comparison: { delta: 3, deltaPct: 50, progressPct: 90 },
};

/**
 * The list and the record route are the same pathname, so a fixed map cannot
 * express "empty before, one row after". This answers the GET from whatever the
 * POST has done, which is what proves the section re-read the server instead of
 * painting the row it just submitted.
 */
function stubOutcomesServer(calls: StubFetchCall[], recorded: Array<typeof outcome>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const rawBody = init?.body;
      calls.push({
        method: init?.method ?? 'GET',
        path,
        body: typeof rawBody === 'string' ? (JSON.parse(rawBody) as unknown) : undefined,
      });
      if (init?.method === 'POST') recorded.push(outcome);
      const body =
        init?.method === 'POST'
          ? { outcome, interpretation: { agentRunId: null, reason: null } }
          : path === '/credits'
            ? { allowance: 100, consumed: 0, purchasedBalance: 0 }
            : path === '/credits/pricing'
              ? { operations: [{ taskType: 'interpret-outcome', credits: 2 }] }
              : { outcomes: [...recorded] };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OutcomesSection', () => {
  it('lists what was measured, when it was observed and where it came from', async () => {
    // "An Outcome without provenance is not trustworthy" — docs/domains/
    // analytics.md §11. A bare number on the page is exactly that.
    stubFetch({ '/experiments/exp-1/outcomes': { body: { outcomes: [outcome] } } });

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={10} />);

    expect(await screen.findByText('9 calls')).toBeInTheDocument();
    expect(screen.getByText(/Aug 20, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Entered by hand/)).toBeInTheDocument();
  });

  it('shows the measurement against the target without calling it a result', async () => {
    // docs/domains/experiments.md §14: "Completed ≠ Successful". successCriteria
    // is free text, so no honest verdict can be computed — the page shows the
    // two numbers and lets the human write the learning.
    stubFetch({ '/experiments/exp-1/outcomes': { body: { outcomes: [outcome] } } });

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={10} />);

    expect(await screen.findByText(/against a target of 10/i)).toBeInTheDocument();
    expect(screen.queryByText(/success|successful|failed|passed|won|achieved/i)).not.toBeInTheDocument();
  });

  it('reads the movement and the share of the target, and still names no winner', async () => {
    // docs/domains/analytics.md §22 asks for observed vs baseline vs target.
    // Arithmetic is allowed; a label calling it a result is not.
    stubFetch({ '/experiments/exp-1/outcomes': { body: { outcomes: [outcome] } } });

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={10} />);

    expect(await screen.findByText(/\+3 since the start \(\+50%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/90% of target/i)).toBeInTheDocument();
    expect(screen.queryByText(/success|successful|failed|passed|won|achieved/i)).not.toBeInTheDocument();
  });

  it('renders a measurement that arrived without a comparison', async () => {
    // A response cached before the field existed is still a measurement worth
    // showing — the section must not blank out over a missing computation.
    const { comparison: _comparison, ...legacy } = outcome;
    stubFetch({ '/experiments/exp-1/outcomes': { body: { outcomes: [legacy] } } });

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={10} />);

    expect(await screen.findByText('9 calls')).toBeInTheDocument();
    expect(screen.queryByText(/since the start/i)).not.toBeInTheDocument();
  });

  it('shows the value alone when the experiment set no target', async () => {
    stubFetch({ '/experiments/exp-1/outcomes': { body: { outcomes: [outcome] } } });

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={null} />);

    expect(await screen.findByText('9 calls')).toBeInTheDocument();
    expect(screen.queryByText(/against a target/i)).not.toBeInTheDocument();
  });

  it('says plainly that nothing has been measured yet', async () => {
    stubFetch({ '/experiments/exp-1/outcomes': { body: { outcomes: [] } } });

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={10} />);

    expect(await screen.findByText(/nothing measured yet/i)).toBeInTheDocument();
  });

  it('records a measurement against the experiment and re-reads the list', async () => {
    const calls: StubFetchCall[] = [];
    stubOutcomesServer(calls, []);

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={10} />);

    await userEvent.type(await screen.findByLabelText(/measured value/i), '9');
    await userEvent.type(screen.getByLabelText(/unit/i), 'calls');
    await userEvent.click(screen.getByRole('button', { name: /record and interpret/i }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST');
      expect(post?.path).toBe('/experiments/exp-1/outcomes');
      expect(post?.body).toEqual({ value: 9, unit: 'calls' });
    });
    // The row comes from the refetch, not from the value that was typed.
    expect(await screen.findByText(/Entered by hand/)).toBeInTheDocument();
  });

  it('keeps what was typed and shows the server reason when the record is refused', async () => {
    // Retyping a measurement because the server disagreed about its date is
    // how a number gets mistyped the second time. The list and the record route
    // share a pathname, so only the method can tell them apart here.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(
            JSON.stringify({ error: { code: 'AUR-V0001', message: 'An outcome cannot be observed in the future' } }),
            { status: 400, headers: { 'content-type': 'application/json' } },
          );
        }
        const path = new URL(url).pathname;
        const body =
          path === '/credits'
            ? { allowance: 100, consumed: 0, purchasedBalance: 0 }
            : path === '/credits/pricing'
              ? { operations: [{ taskType: 'interpret-outcome', credits: 2 }] }
              : { outcomes: [] };
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={10} />);

    await userEvent.type(await screen.findByLabelText(/measured value/i), '9');
    await userEvent.click(screen.getByRole('button', { name: /record and interpret/i }));

    expect(await screen.findByText('An outcome cannot be observed in the future')).toBeInTheDocument();
    expect(screen.getByLabelText(/measured value/i)).toHaveValue(9);
  });

  // Nada é cobrado sem estar escrito na tela antes do clique.
  it('diz o preço e o saldo antes de gravar', async () => {
    stubFetch({
      '/experiments/exp-1/outcomes': { body: { outcomes: [] } },
      '/credits': { body: { allowance: 100, consumed: 10, purchasedBalance: 0 } },
      '/credits/pricing': { body: { operations: [{ taskType: 'interpret-outcome', credits: 2 }] } },
    });

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={10} />);

    expect(
      await screen.findByText(i18n.t('pages.experiments.outcomes.cost', { credits: 2 })),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('pages.experiments.outcomes.recordAndInterpret') }),
    ).toBeInTheDocument();
  });

  // A medição é fato observado, e o faturamento não pode apagá-la: com saldo
  // curto o aviso aparece e o botão continua clicável. Desabilitar aqui perderia
  // o número por falta de crédito — exatamente o que o loop existe para
  // registrar — e contradiria a própria cópia, que diz que a leitura fica para
  // depois.
  it('deixa gravar o número mesmo sem saldo para a leitura', async () => {
    stubFetch({
      '/experiments/exp-1/outcomes': { body: { outcomes: [] } },
      '/credits': { body: { allowance: 1, consumed: 1, purchasedBalance: 0 } },
      '/credits/pricing': { body: { operations: [{ taskType: 'interpret-outcome', credits: 2 }] } },
    });

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={10} />);

    expect(await screen.findByText(i18n.t('pages.experiments.outcomes.short'))).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: i18n.t('pages.experiments.outcomes.recordAndInterpret') }),
    ).toBeEnabled();
  });

  // A medição é fato observado: a leitura que não rodou é um aviso com o motivo,
  // nunca uma mensagem que sugira que o número se perdeu.
  it('avisa quando o número foi gravado mas a leitura não rodou', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        const body =
          init?.method === 'POST'
            ? { outcome, interpretation: { agentRunId: null, reason: 'Insufficient credits' } }
            : path === '/credits'
              ? { allowance: 100, consumed: 0, purchasedBalance: 0 }
              : path === '/credits/pricing'
                ? { operations: [{ taskType: 'interpret-outcome', credits: 2 }] }
                : { outcomes: [] };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );

    renderWithProviders(<OutcomesSection experimentId="exp-1" metric="discovery_calls_booked" targetValue={10} />);

    await userEvent.type(await screen.findByLabelText(i18n.t('pages.experiments.outcomes.valueLabel')), '9');
    await userEvent.click(
      screen.getByRole('button', { name: i18n.t('pages.experiments.outcomes.recordAndInterpret') }),
    );

    expect(
      await screen.findByText(
        i18n.t('pages.experiments.outcomes.recordedWithoutInterpretation', { reason: 'Insufficient credits' }),
      ),
    ).toBeInTheDocument();
  });

  it('entrega o run enfileirado para quem lê o resultado', async () => {
    const onInterpretationStarted = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        const body =
          init?.method === 'POST'
            ? { outcome, interpretation: { agentRunId: 'run-1', reason: null } }
            : path === '/credits'
              ? { allowance: 100, consumed: 0, purchasedBalance: 0 }
              : path === '/credits/pricing'
                ? { operations: [{ taskType: 'interpret-outcome', credits: 2 }] }
                : { outcomes: [] };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
      }),
    );

    renderWithProviders(
      <OutcomesSection
        experimentId="exp-1"
        metric="discovery_calls_booked"
        targetValue={10}
        onInterpretationStarted={onInterpretationStarted}
      />,
    );

    await userEvent.type(await screen.findByLabelText(i18n.t('pages.experiments.outcomes.valueLabel')), '9');
    await userEvent.click(
      screen.getByRole('button', { name: i18n.t('pages.experiments.outcomes.recordAndInterpret') }),
    );

    await waitFor(() => expect(onInterpretationStarted).toHaveBeenCalledWith('run-1'));
  });
});
