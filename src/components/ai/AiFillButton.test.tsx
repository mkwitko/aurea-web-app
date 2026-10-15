import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { AiFillButton, type AiFillButtonProps } from './AiFillButton';

/**
 * Reads the actual copy through the app's own i18n instance, the same idiom
 * as ResearchPanel.test.tsx / useFillRun.test.tsx: pins the key today, and the
 * sentence once real copy lands, never the other one.
 */
const copy = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options ?? {});

const TASK_TYPE = 'fill-test-task';
const ALLOWED_PATHS = ['profile.cac', 'profile.name'] as const;

const pricing = { operations: [{ taskType: TASK_TYPE, credits: 5 }] };
const rich = {
  plan: 'GROWTH',
  allowance: 100,
  consumed: 0,
  purchasedBalance: 0,
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-08-01T00:00:00.000Z',
};
// 2 credits available against a 5-credit run.
const broke = { ...rich, consumed: 98 };

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

function makeRun(overrides: Partial<Run> & Pick<Run, 'id'>): Run {
  return {
    taskType: TASK_TYPE,
    agentType: 'fill-agent',
    status: 'PENDING',
    input: { foo: 'bar' },
    output: null,
    error: null,
    model: null,
    createdAt: '2026-07-29T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

const questionA = {
  id: 'q1',
  ask: 'What is your CAC?',
  why: 'It changes which channel we recommend.',
  answerType: 'currency',
  fills: 'profile.cac',
  impact: 3,
};

const outputGood = { filled: { name: 'Acme' }, questions: [questionA], confidence: 'MEDIUM' };
const runDone = makeRun({ id: 'run-1', status: 'COMPLETED', output: outputGood });

// `fills` points outside the allow-list this screen declared — the whole
// result is refused, not just this one question. A distinct `ask` (not
// reused from `questionA`) is what makes it possible to assert the good
// question's text is genuinely absent in the unreadable state, rather than
// merely asserting the same string that would render either way.
const badQuestion = {
  ...questionA,
  id: 'q-bad',
  ask: 'This question must never reach the screen.',
  fills: 'not.allowed',
};
const outputBad = { filled: {}, questions: [badQuestion], confidence: 'LOW' };
const runDoneBad = makeRun({ id: 'run-1', status: 'COMPLETED', output: outputBad });

const runFailed = makeRun({ id: 'run-1', status: 'FAILED', error: 'The model refused the request' });

/** The three queries every branch needs, plus the run detail when one exists. */
function serverWith(run: Run | null, overrides: Record<string, { status?: number; body: unknown }> = {}) {
  return {
    '/credits': { body: rich },
    '/credits/pricing': { body: pricing },
    '/agent-runs': { body: { runs: run ? [run] : [] } },
    ...(run ? { [`/agent-runs/${run.id}`]: { body: run } } : {}),
    ...overrides,
  };
}

const base = serverWith(null);

function renderButton(overrides: Partial<AiFillButtonProps> = {}) {
  const onFilled = overrides.onFilled ?? vi.fn();
  const onAnswer = overrides.onAnswer ?? vi.fn();
  const result = renderWithProviders(
    <AiFillButton
      taskType={TASK_TYPE}
      input={{ foo: 'bar' }}
      allowedPaths={ALLOWED_PATHS}
      label="Generate with AI"
      onFilled={onFilled}
      onAnswer={onAnswer}
      {...overrides}
    />,
  );
  return { ...result, onFilled, onAnswer };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('AiFillButton — the button', () => {
  it('renders the cost from /credits/pricing for this taskType', async () => {
    stubFetch(base);

    renderButton();

    expect(await screen.findByText(copy('ai.fill.cost', { credits: 5 }))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate with AI' })).toBeEnabled();
  });

  it('warns, with a link to billing, when the balance is below the cost — guidance, not authorization', async () => {
    // The button itself only ever gets disabled client-side as a courtesy —
    // the worker still authorizes the run independently of this check.
    stubFetch(serverWith(null, { '/credits': { body: broke } }));

    renderButton();

    expect(await screen.findByText(copy('ai.fill.cost', { credits: 5 }))).toBeInTheDocument();
    expect(screen.getByText(copy('ai.fill.short'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy('ai.fill.topUp') })).toHaveAttribute(
      'href',
      '/app/settings/billing',
    );
    expect(screen.getByRole('button', { name: 'Generate with AI' })).toBeDisabled();
  });

  it('renders blockedReason instead of the button when one is given, and the button is not in the document at all', async () => {
    stubFetch(base);

    renderButton({ blockedReason: { message: 'Fill in your business profile first', to: '/app/business', linkLabel: 'go to profile' } });

    expect(await screen.findByText('Fill in your business profile first')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'go to profile' })).toHaveAttribute('href', '/app/business');
    // Not just hidden or disabled — genuinely absent, so a screen reader never
    // announces a dead control.
    expect(screen.queryByRole('button', { name: 'Generate with AI' })).not.toBeInTheDocument();
  });

  it('does not treat a still-loading balance as zero: the button stays enabled and no short-balance warning shows while /credits is in flight', async () => {
    // `short = cost !== null && balance !== null && balance < cost`. Every
    // other test resolves both queries before asserting, so this is the only
    // one that actually exercises the loading window: `/credits/pricing`
    // resolves immediately (`cost` becomes 5) while `/credits` is held open
    // (`balance` stays `null`). In JS, `null < 5` is `true` — so a `short`
    // expression missing the `balance !== null` check would misread exactly
    // this window as short and wrongly disable/warn a founder who has money,
    // just because the network was slow.
    let releaseCredits: ((body: unknown) => void) | undefined;
    const creditsHeld = new Promise<unknown>((resolve) => {
      releaseCredits = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
        if (path === '/credits') return json(await creditsHeld);
        if (path === '/credits/pricing') return json(pricing);
        if (path === '/agent-runs') return json({ runs: [] });
        throw new Error(`unstubbed ${path}`);
      }),
    );

    renderButton();

    // Confirms `cost` really has resolved by this point, so the assertions
    // below are about the `balance` window specifically, not both queries
    // still loading.
    expect(await screen.findByText(copy('ai.fill.cost', { credits: 5 }))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate with AI' })).toBeEnabled();
    expect(screen.queryByText(copy('ai.fill.short'))).not.toBeInTheDocument();

    releaseCredits?.(rich);
    // Let the held query settle so no test leaves a dangling fetch behind.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Generate with AI' })).toBeEnabled());
  });

  it('clicking starts a run with { taskType, input }', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(base, calls);

    renderButton();

    await userEvent.click(await screen.findByRole('button', { name: 'Generate with AI' }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST');
      expect(post?.path).toBe('/agent-runs');
      expect(post?.body).toEqual({ taskType: TASK_TYPE, input: { foo: 'bar' } });
    });
  });
});

describe('AiFillButton — waiting and failure', () => {
  it('shows a waiting state while the run is not terminal', async () => {
    stubFetch(serverWith(makeRun({ id: 'run-1', status: 'RUNNING' })));

    renderButton();

    expect(await screen.findByText(copy('ai.fill.thinking'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate with AI' })).not.toBeInTheDocument();
  });

  it("shows the run's error and a retry when the run fails, and clicking retry re-triggers the run", async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(serverWith(runFailed), calls);

    renderButton();

    // A mensagem do runner é escrita para quem mantém o runner. O fundador lê
    // o que aconteceu e o que fazer; o jargão fica nos detalhes técnicos, que
    // continuam no DOM porque é o que resolve um chamado de suporte.
    expect(await screen.findByText(copy('ai.fill.error.refused.title'))).toBeInTheDocument();
    expect(screen.getByText(copy('ai.fill.error.refused.body'))).toBeInTheDocument();
    expect(screen.getByText('The model refused the request')).toBeInTheDocument();
    // O crédito de um run que falhou volta (onRunFailed no backend) — e essa é
    // a única coisa que o fundador quer saber na hora.
    expect(screen.getByText(copy('ai.fill.error.refunded'))).toBeInTheDocument();
    // Mesmo bloco do primeiro clique: preço na tela antes de gastar de novo.
    expect(screen.getByText(copy('ai.fill.cost', { credits: 5 }))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: copy('ai.fill.retry') }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST');
      expect(post?.path).toBe('/agent-runs');
      expect(post?.body).toEqual({ taskType: TASK_TYPE, input: { foo: 'bar' } });
    });
  });

  it('shows a message and a retry when starting the run fails outright — state never becomes "failed" here', async () => {
    // The gap the brief's own component code leaves: `useFillRun` reports a
    // create failure as `state: 'idle'` with a non-null `error` (see
    // useFillRun.test.tsx, "surfaces the start failure and stays idle").
    // Gating this card on `state === 'failed'` would show nothing at all —
    // the fix is to gate on `error !== null` instead.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        const method = init?.method ?? 'GET';
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
        if (path === '/credits') return json(rich);
        if (path === '/credits/pricing') return json(pricing);
        if (path === '/agent-runs' && method === 'GET') return json({ runs: [] });
        if (path === '/agent-runs' && method === 'POST') {
          // No `error.message` in the body, same as useFillRun.test.tsx's
          // equivalent case: `apiErrorMessage` has nothing to read and must
          // fall back to exactly `startFailedMessage` (`ai.fill.startFailed`).
          return json({ nothingUseful: true }, 500);
        }
        throw new Error(`unstubbed ${method} ${path}`);
      }),
    );

    renderButton();

    await userEvent.click(await screen.findByRole('button', { name: 'Generate with AI' }));

    // Create falho não debitou nada: a mensagem da API é o corpo, e nenhuma
    // promessa de estorno aparece — não houve o que estornar.
    expect(await screen.findByText(copy('ai.fill.startFailed'))).toBeInTheDocument();
    expect(screen.queryByText(copy('ai.fill.error.refunded'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy('ai.fill.retry') })).toBeInTheDocument();
  });
});

describe('AiFillButton — a completed run', () => {
  it('calls onFilled(filled, runId) exactly once, and again for a genuinely new run — not for a refetch of the same one', async () => {
    // Two things have to hold at once, and a boolean guard breaks the second
    // one: (1) a refetch that resolves the SAME completed run again must not
    // re-fire onFilled — that would overwrite whatever the founder edited
    // since the proposal landed; (2) a later, genuinely different completed
    // run — "generate again" — must still fire it. A `useRef<boolean>` that
    // flips to `true` forever would satisfy (1) but permanently break (2);
    // only a guard keyed on the run id satisfies both.
    let postCount = 0;
    const outputGood2 = {
      filled: { name: 'Beta' },
      questions: [{ ...questionA, id: 'q2' }],
      confidence: 'HIGH',
    };
    const runTwo = makeRun({ id: 'run-2', status: 'COMPLETED', output: outputGood2 });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        const method = init?.method ?? 'GET';
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
        if (path === '/credits') return json(rich);
        if (path === '/credits/pricing') return json(pricing);
        // The recovery query never learns about run-2 — nothing invalidates
        // it — so it keeps answering with run-1 for the whole test, same as
        // the real backend behaviour these hooks were written against.
        if (path === '/agent-runs' && method === 'GET') return json({ runs: [runDone] });
        if (path === '/agent-runs' && method === 'POST') {
          postCount += 1;
          return json(runTwo, 202);
        }
        if (path === '/agent-runs/run-1') return json(runDone);
        if (path === '/agent-runs/run-2') return json(runTwo);
        throw new Error(`unstubbed ${method} ${path}`);
      }),
    );

    const { onFilled, queryClient } = renderButton();

    await screen.findByText(questionA.ask);
    expect(onFilled).toHaveBeenCalledTimes(1);
    // `adopted: true` — run-1 came from the recovery query, not from a click.
    expect(onFilled).toHaveBeenCalledWith(outputGood.filled, 'run-1', true);

    // Force the exact scenario the brief calls out: the poll resolving the
    // same completed run again, via a refetch rather than a new mount.
    await act(async () => {
      await queryClient.invalidateQueries();
    });
    await waitFor(() => expect(screen.getByText(questionA.ask)).toBeInTheDocument());
    expect(onFilled).toHaveBeenCalledTimes(1);

    // "Generate again" — a genuinely new run must still get its own call.
    await userEvent.click(screen.getByRole('button', { name: copy('ai.fill.again') }));

    await waitFor(() => expect(onFilled).toHaveBeenCalledTimes(2));
    // `adopted: false` — run-2 exists because "generate again" was clicked.
    expect(onFilled).toHaveBeenNthCalledWith(2, outputGood2.filled, 'run-2', false);
    expect(postCount).toBe(1);
  });

  it('shows the unreadable card and never calls onFilled when the output cannot be parsed', async () => {
    stubFetch(serverWith(runDoneBad));

    const { onFilled } = renderButton();

    expect(await screen.findByText(copy('ai.fill.error.unreadable.title'))).toBeInTheDocument();
    // Este run COMPLETOU: não há estorno, e a tela diz isso antes de o fundador
    // ver a cobrança no extrato.
    expect(screen.getByText(copy('ai.fill.error.charged'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy('ai.fill.retry') })).toBeInTheDocument();
    expect(onFilled).not.toHaveBeenCalled();
    // Proves the unreadable branch and the panel branch are mutually
    // exclusive: `badQuestion.ask` is distinct from `questionA.ask`
    // specifically so this assertion cannot pass by coincidence.
    expect(screen.queryByText(badQuestion.ask)).not.toBeInTheDocument();
  });

  it("renders AiFillPanel with the run's questions", async () => {
    stubFetch(serverWith(runDone));

    renderButton();

    expect(await screen.findByText(copy('ai.fill.panelTitle'))).toBeInTheDocument();
    expect(screen.getByText(questionA.ask)).toBeInTheDocument();
    expect(screen.getByText(questionA.why)).toBeInTheDocument();
  });
});
