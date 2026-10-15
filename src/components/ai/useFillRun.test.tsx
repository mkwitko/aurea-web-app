import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { useFillRun } from './useFillRun';

const TASK_TYPE = 'fill-test-section';
const START_FAILED = 'could not start, try again';

/** Reads the actual copy through i18n, the same way the hook does — see ResearchPanel.test.tsx. */
const copy = (key: string): string => i18n.t(key);

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
    input: { section: 'about' },
    output: null,
    error: null,
    model: null,
    createdAt: '2026-07-29T00:00:00.000Z',
    completedAt: null,
    ...overrides,
  };
}

/** Renders the hook through a probe, the same idiom auth.test.tsx uses for useAuth. */
function Probe(props: {
  taskType: string;
  input: Record<string, unknown> | null;
  matchesInput?: (input: unknown) => boolean;
  startFailedMessage: string;
}) {
  const result = useFillRun(props);
  return (
    <div>
      <span data-testid="state">{result.state}</span>
      <span data-testid="runId">{result.runId ?? 'none'}</span>
      <span data-testid="output">{JSON.stringify(result.output)}</span>
      <span data-testid="error">{result.error ?? 'none'}</span>
      <span data-testid="foreign">{String(result.isForeign)}</span>
      <span data-testid="startedAt">{result.startedAt?.toISOString() ?? 'none'}</span>
      <button onClick={result.start}>start</button>
      <button onClick={result.cancel}>cancel</button>
    </div>
  );
}

function renderProbe(props: Partial<Parameters<typeof Probe>[0]> = {}) {
  return renderWithProviders(
    <Probe
      taskType={TASK_TYPE}
      input={{ section: 'about' }}
      startFailedMessage={START_FAILED}
      {...props}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  // Defensive: if a fake-timers test fails before reaching its own
  // `vi.useRealTimers()`, later tests must not inherit a mocked clock.
  vi.useRealTimers();
});

describe('useFillRun', () => {
  it("starts a run and exposes state 'running' while the poll has no terminal status", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        const method = init?.method ?? 'GET';
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
        if (path === '/agent-runs' && method === 'GET') return json({ runs: [] });
        if (path === '/agent-runs' && method === 'POST') {
          return json(makeRun({ id: 'run-new', status: 'RUNNING' }), 202);
        }
        if (path === '/agent-runs/run-new') return json(makeRun({ id: 'run-new', status: 'RUNNING' }));
        throw new Error(`unstubbed ${method} ${path}`);
      }),
    );

    renderProbe();

    expect(await screen.findByTestId('state')).toHaveTextContent('idle');

    await userEvent.click(screen.getByRole('button', { name: 'start' }));

    await waitFor(() => expect(screen.getByTestId('runId')).toHaveTextContent('run-new'));
    expect(screen.getByTestId('state')).toHaveTextContent('running');
  });

  it("moves to 'done' and exposes output when the run reports COMPLETED", async () => {
    const run = makeRun({ id: 'run-done', status: 'COMPLETED', output: { proposal: 'Use TikTok' } });
    stubFetch({ '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-done': { body: run } });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('done'));
    expect(screen.getByTestId('output')).toHaveTextContent(JSON.stringify({ proposal: 'Use TikTok' }));
  });

  it("moves to 'failed' when the run reports FAILED, and surfaces run.error as the message", async () => {
    const run = makeRun({ id: 'run-failed', status: 'FAILED', error: 'The model refused the request' });
    stubFetch({ '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-failed': { body: run } });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('failed'));
    expect(screen.getByTestId('error')).toHaveTextContent('The model refused the request');
  });

  it(
    "moves to 'failed' when the poll itself errors — never an infinite spinner, and actually stops polling",
    async () => {
      // A state-only assertion ("the failed card shows up") would pass even
      // with the `query.state.status === 'error'` branch deleted from
      // `refetchInterval`: `state` reaches 'failed' via `run.isError` either
      // way. The only way to catch that regression is to hold time still once
      // errored and show the request count does not grow — the same shape as
      // ResearchPanel.test.tsx's equivalent guard.
      //
      // No `shouldAdvanceTime`: at a real 30s cadence, syncing the fake clock
      // to wall time would make this test actually take tens of seconds. The
      // clock is driven by hand instead.
      vi.useFakeTimers();

      const run = makeRun({ id: 'run-poll-error', status: 'RUNNING' });
      let detailCalls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          const path = new URL(url).pathname;
          const json = (body: unknown, status = 200) =>
            new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
          if (path === '/agent-runs') return json({ runs: [run] });
          detailCalls += 1;
          return json({ error: { code: 'INTERNAL', message: 'boom' } }, 500);
        }),
      );

      renderProbe();

      // The test client has retries off, so the very first failed fetch is
      // already the terminal 'error' state. The recovery query (list, then
      // detail) is a chain of dependent fetches with react-query's own
      // batching in between, so draining every pending timer — not just one
      // microtask flush — is what's needed to walk all the way through it.
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(screen.getByTestId('state')).toHaveTextContent('failed');
      // Not a start error (no create call happened) — the fallback is the
      // run's own i18n failure copy, never `startFailedMessage`.
      expect(screen.getByTestId('error')).toHaveTextContent(copy('ai.fill.failed'));
      const callsAtError = detailCalls;
      expect(callsAtError).toBeGreaterThan(0);

      // Comfortably past one more interval: a regression that kept polling
      // through the error state would show up as an extra call here.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(40_000);
      });

      expect(detailCalls).toBe(callsAtError);

      vi.useRealTimers();
    },
    15_000,
  );

  it('adopts the newest run of this taskType on mount, whatever its status', async () => {
    const run = makeRun({ id: 'run-recovered', status: 'PENDING' });
    stubFetch({ '/agent-runs': { body: { runs: [run] } }, '/agent-runs/run-recovered': { body: run } });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('runId')).toHaveTextContent('run-recovered'));
    // PENDING is not terminal, so the machine reports 'running', not 'idle'.
    expect(screen.getByTestId('state')).toHaveTextContent('running');
  });

  it('ignores an adopted run that matchesInput rejects, and stays idle', async () => {
    const run = makeRun({ id: 'run-other-section', status: 'COMPLETED', input: { section: 'other' } });
    stubFetch({ '/agent-runs': { body: { runs: [run] } } });

    const matchesInput = (input: unknown) =>
      typeof input === 'object' && input !== null && (input as { section?: unknown }).section === 'about';

    renderProbe({ matchesInput });

    // Give the recovery query a turn to resolve before asserting the negative.
    await screen.findByTestId('state');
    await waitFor(() => expect(screen.getByTestId('runId')).toHaveTextContent('none'));
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
  });

  it('start() is a no-op while input is null', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ '/agent-runs': { body: { runs: [] } } }, calls);

    renderProbe({ input: null });

    await screen.findByTestId('state');
    await userEvent.click(screen.getByRole('button', { name: 'start' }));

    expect(screen.getByTestId('state')).toHaveTextContent('idle');
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('start() on an already-adopted run creates a NEW run rather than re-showing the adopted one', async () => {
    const runA = makeRun({ id: 'run-a', status: 'COMPLETED', output: { proposal: 'old' } });

    let releasePost: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      releasePost = resolve;
    });
    const postBodies: Array<{ taskType: string; input: unknown }> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        const method = init?.method ?? 'GET';
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
        if (path === '/agent-runs' && method === 'GET') {
          // The recovery query never learns about run-b: it keeps answering
          // with run-a, exactly the race a create mutation leaves behind since
          // nothing invalidates this query on success.
          return json({ runs: [runA] });
        }
        if (path === '/agent-runs' && method === 'POST') {
          postBodies.push(JSON.parse(init!.body as string) as { taskType: string; input: unknown });
          await held;
          return json(makeRun({ id: 'run-b', status: 'RUNNING', output: null }), 202);
        }
        if (path === '/agent-runs/run-a') return json(runA);
        if (path === '/agent-runs/run-b') return json(makeRun({ id: 'run-b', status: 'RUNNING', output: null }));
        throw new Error(`unstubbed ${method} ${path}`);
      }),
    );

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('done'));
    expect(screen.getByTestId('runId')).toHaveTextContent('run-a');

    await userEvent.click(screen.getByRole('button', { name: 'start' }));

    // While the new run is being created, the stale recovery answer (still
    // run-a) must not resurface — the button has to look like it did
    // something, not like a no-op. Asserted as an exact 'none', not just
    // "isn't run-a": `runId` is cleared by `start()` itself, and `adoptable`
    // is separately blocked by `dismissed`, so nothing should fill it in.
    expect(screen.getByTestId('state')).toHaveTextContent('starting');
    expect(screen.getByTestId('runId')).toHaveTextContent('none');
    expect(screen.getByTestId('output')).toHaveTextContent('null');

    releasePost?.();

    await waitFor(() => expect(screen.getByTestId('runId')).toHaveTextContent('run-b'));
    expect(postBodies).toEqual([{ taskType: TASK_TYPE, input: { section: 'about' } }]);
  });

  it('a SECOND generate-again also hides the previous explicit run during its pending gap, even when the backend dedupes it back', async () => {
    // Distinct from the previous test: there, the run showing before the
    // click was only ever *adopted* (`runId` was still null, so clearing
    // `dismissed` alone was enough — `runId ?? adoptable` fell through to
    // `adoptable`, which `dismissed` blocked). Here the run showing before the
    // click was itself the result of an earlier EXPLICIT `start()`, so `runId`
    // is already non-null and would win over `adoptable` unconditionally —
    // exactly the gap Finding 1 describes. It also exercises the real reason
    // `POST /agent-runs` can legitimately hand back the very id just
    // dismissed: the backend dedupes an active (PENDING/RUNNING) run against
    // an unchanged input hash (`findActiveByHash` in
    // `create-agent-run.service.ts`) instead of creating a second one.
    let releaseSecondPost: (() => void) | undefined;
    const secondHeld = new Promise<void>((resolve) => {
      releaseSecondPost = resolve;
    });
    let postCount = 0;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        const method = init?.method ?? 'GET';
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
        // The recovery query never learns about anything the create endpoint
        // does — nothing invalidates it — so it keeps answering with run-a,
        // unchanged, RUNNING, for the whole test.
        const runA = makeRun({ id: 'run-a', status: 'RUNNING' });
        if (path === '/agent-runs' && method === 'GET') return json({ runs: [runA] });
        if (path === '/agent-runs' && method === 'POST') {
          postCount += 1;
          if (postCount === 1) return json(runA, 202);
          // Second click: the backend dedupes to the SAME active run rather
          // than minting a new id.
          await secondHeld;
          return json(runA, 202);
        }
        if (path === '/agent-runs/run-a') return json(runA);
        throw new Error(`unstubbed ${method} ${path}`);
      }),
    );

    renderProbe();

    expect(await screen.findByTestId('state')).toHaveTextContent('idle');

    // First, genuine start — `runId` becomes non-null via `onSuccess`, not
    // via adoption.
    await userEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() => expect(screen.getByTestId('runId')).toHaveTextContent('run-a'));
    expect(screen.getByTestId('state')).toHaveTextContent('running');

    // Second start — "generate again" on a run that is still active.
    await userEvent.click(screen.getByRole('button', { name: 'start' }));

    // While the dedup lookup is in flight, the previous explicit run must not
    // leak through `runId`/`output` — this is exactly what regresses without
    // `setRunId(null)` in `start()`.
    expect(screen.getByTestId('state')).toHaveTextContent('starting');
    expect(screen.getByTestId('runId')).toHaveTextContent('none');
    expect(screen.getByTestId('output')).toHaveTextContent('null');

    releaseSecondPost?.();

    // Once the dedup response lands, the same run becomes visible again —
    // the effect that clears `dismissed` is what keeps this from getting
    // stuck, per the comment on it in the hook.
    await waitFor(() => expect(screen.getByTestId('runId')).toHaveTextContent('run-a'));
    expect(screen.getByTestId('state')).toHaveTextContent('running');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    expect(postCount).toBe(2);
  });

  it('surfaces the start failure and stays idle, rather than reporting state: failed', async () => {
    // A run never got created, so there is nothing for `run.isError`/`status`
    // to react to — `state` has no path to 'failed' here. `error` must still
    // be non-null so a consumer knows to show it: gating error display on
    // `state === 'failed'` would silently hide this message forever. This
    // also exercises `startFailedMessage` itself: the stubbed 500 body below
    // carries no `error.message`, so `apiErrorMessage` has nothing to read
    // and must fall back to exactly the string this hook was given.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        const method = init?.method ?? 'GET';
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
        if (path === '/agent-runs' && method === 'GET') return json({ runs: [] });
        if (path === '/agent-runs' && method === 'POST') return json({ nothingUseful: true }, 500);
        throw new Error(`unstubbed ${method} ${path}`);
      }),
    );

    renderProbe();

    expect(await screen.findByTestId('state')).toHaveTextContent('idle');

    await userEvent.click(screen.getByRole('button', { name: 'start' }));

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent(START_FAILED));
    expect(screen.getByTestId('state')).toHaveTextContent('idle');
    expect(screen.getByTestId('runId')).toHaveTextContent('none');
  });
  // O 409 do backend (AUR-T0035) diz que existe um run em voo no mesmo escopo
  // — outra seção do mesmo contexto, por exemplo. Só mostrar a mensagem
  // deixaria o fundador sem saída nenhuma: é adotando o run apontado que a
  // tela consegue mostrar o cronômetro e oferecer o cancelar.
  it('adopts the in-flight run the backend points to on a 409', async () => {
    const foreign = makeRun({ id: 'run-outra-secao', status: 'RUNNING', input: { section: 'market' } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = new URL(url).pathname;
        const method = init?.method ?? 'GET';
        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
        if (path === '/agent-runs' && method === 'GET') return json({ runs: [] });
        if (path === '/agent-runs' && method === 'POST') {
          return json(
            {
              error: {
                code: 'AUR-T0035',
                message: 'já existe uma análise em andamento',
                details: { runId: 'run-outra-secao', taskType: TASK_TYPE, startedAt: foreign.createdAt },
              },
            },
            409,
          );
        }
        if (path === '/agent-runs/run-outra-secao') return json(foreign);
        throw new Error(`unstubbed ${method} ${path}`);
      }),
    );

    renderProbe();
    expect(await screen.findByTestId('state')).toHaveTextContent('idle');

    await userEvent.click(screen.getByRole('button', { name: 'start' }));

    await waitFor(() => expect(screen.getByTestId('runId')).toHaveTextContent('run-outra-secao'));
    expect(screen.getByTestId('state')).toHaveTextContent('running');
    // Marcado como alheio: a tela precisa dizer que o que roda não é o que
    // este botão pediu.
    expect(screen.getByTestId('foreign')).toHaveTextContent('true');
    // Sem mensagem de erro: existe run e existe saída, não é uma falha.
    expect(screen.getByTestId('error')).toHaveTextContent('none');
    expect(screen.getByTestId('startedAt')).toHaveTextContent(foreign.createdAt);
  });

  it('cancels the in-flight run and goes back to the button', async () => {
    const run = makeRun({ id: 'run-em-voo', status: 'RUNNING' });
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/agent-runs': { body: { runs: [run] } },
        '/agent-runs/run-em-voo': { body: run },
        '/agent-runs/run-em-voo/cancel': { body: { ...run, status: 'CANCELLED' } },
      },
      calls,
    );

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('running'));

    await userEvent.click(screen.getByRole('button', { name: 'cancel' }));

    // Volta ao botão, não ao card do run cancelado: quem cancelou quer fazer
    // outra coisa. `dismissed` é o que impede a query de recuperação de
    // readotar o mesmo run no próximo refetch.
    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('idle'));
    expect(screen.getByTestId('runId')).toHaveTextContent('none');
    expect(calls.some((call) => call.method === 'POST' && call.path === '/agent-runs/run-em-voo/cancel')).toBe(true);
  });
});
