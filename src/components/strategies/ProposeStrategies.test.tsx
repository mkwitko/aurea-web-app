import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import i18n from '@/i18n';
import { ProposeStrategies } from './ProposeStrategies';

/** Resolves a copy key through the app's own i18n instance, never a hard-coded string. */
const copy = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options ?? {});

const goals = { goals: [{ id: 'goal-1', name: 'Ten discovery calls', metric: 'discovery_calls_booked', status: 'ACTIVE' }] };
// Two ACTIVE goals: the fixture the "which goal does this button target"
// tests need, since a single-goal workspace can never tell "resolved the
// right goal" apart from "fell back to actionable[0] and got lucky".
const goalsTwo = {
  goals: [
    { id: 'goal-1', name: 'Ten discovery calls', metric: 'discovery_calls_booked', status: 'ACTIVE' },
    { id: 'goal-2', name: 'Cut CAC by 20%', metric: 'cac', status: 'ACTIVE' },
  ],
};
const pricing = { operations: [{ taskType: 'propose-strategies', credits: 3 }] };
const rich = { plan: 'GROWTH', allowance: 100, consumed: 0, purchasedBalance: 0, periodStart: '2026-07-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z' };
const broke = { ...rich, consumed: 99 };

const base = {
  '/goals': { body: goals },
  '/credits': { body: rich },
  '/credits/pricing': { body: pricing },
  '/agent-runs': { body: { runs: [] } },
};

afterEach(() => {
  vi.unstubAllGlobals();
  // Defensive: if a fake-timers test fails before reaching its own
  // `vi.useRealTimers()`, later tests must not inherit a mocked clock.
  vi.useRealTimers();
});

describe('ProposeStrategies — starting a run', () => {
  it('states what a proposal costs before it is started', async () => {
    stubFetch(base);

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText(/3 credits/i)).toBeInTheDocument();
  });

  it('refuses to start when the balance will not cover the run', async () => {
    // Guidance only — the worker still authorizes. The point is not making the
    // founder wait through a queue to be told no.
    stubFetch({ ...base, '/credits': { body: broke } });

    renderWithProviders(<ProposeStrategies />);

    // Block on the cost line first: it only renders once pricing (and, by the
    // same render pass, credits) has actually resolved. Asserting `disabled`
    // without this waits for nothing in particular — the button starts out
    // disabled anyway (no goal chosen yet), so a same-tick check would pass
    // for the wrong reason instead of proving the balance check fired.
    expect(await screen.findByText(/3 credits/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /propose strategies/i })).toBeDisabled();
    expect(screen.getByText(/not enough credits/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /top up/i })).toHaveAttribute('href', '/app/settings/billing');
  });

  it('starts a run for the chosen goal', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ ...base, '/agent-runs': { body: { runs: [] } } }, calls);

    renderWithProviders(<ProposeStrategies />);

    await userEvent.click(await screen.findByRole('button', { name: /propose strategies/i }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST');
      expect(post?.path).toBe('/agent-runs');
      expect(post?.body).toEqual({ taskType: 'propose-strategies', input: { goalId: 'goal-1' } });
    });
  });

  it('says so when there is no active goal to reason about', async () => {
    stubFetch({ ...base, '/goals': { body: { goals: [] } } });

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText(/set a goal first/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /propose strategies/i })).not.toBeInTheDocument();
  });

  it('shows a retryable error instead of a dead form when goals fail to load', async () => {
    // A failed `/goals` is not "no goals" — the picker must not render over an
    // empty list, since that offers a form with nothing to choose and no way
    // to tell it apart from a workspace that genuinely has no active goal.
    stubFetch({ ...base, '/goals': { status: 500, body: { error: { code: 'INTERNAL', message: 'boom' } } } });

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText('Could not load this section.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /propose strategies/i })).not.toBeInTheDocument();
  });
});

describe('ProposeStrategies — recovering whether a run is already in flight', () => {
  it('does not offer the idle form while the recovery query is still settling', async () => {
    // `recovered` is null both while `/agent-runs` (the recovery query) is in
    // flight and if it fails — indistinguishable from "no run exists" unless
    // the form is held back until it settles. Held open on purpose here, with
    // goals/credits/pricing resolving normally around it, so the test proves
    // the form waits on *this* query specifically rather than any loading
    // state in general.
    let resolveRuns: (value: Response) => void = () => {};
    const runsPromise = new Promise<Response>((resolve) => {
      resolveRuns = resolve;
    });
    const json = (body: unknown) =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = new URL(url).pathname;
        if (path === '/goals') return json(goals);
        if (path === '/credits') return json(rich);
        if (path === '/credits/pricing') return json(pricing);
        if (path === '/agent-runs') return runsPromise;
        throw new Error(`unstubbed ${path}`);
      }),
    );

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /propose strategies/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/3 credits/i)).not.toBeInTheDocument();

    resolveRuns(
      new Response(JSON.stringify({ runs: [] }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );

    expect(await screen.findByRole('button', { name: /propose strategies/i })).toBeInTheDocument();
  });

  it('shows a retryable error instead of an enabled start button when the recovery query fails', async () => {
    // A founder who clicks through a failed recovery query risks starting a
    // second run: the dedup in `findActiveByHash` only saves them when the
    // new run's goal is identical to the one already in flight.
    const calls: StubFetchCall[] = [];
    stubFetch({ ...base, '/agent-runs': { status: 500, body: { error: { code: 'INTERNAL', message: 'boom' } } } }, calls);

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText('Could not load this section.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /propose strategies/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(calls.filter((call) => call.method === 'GET' && call.path === '/agent-runs').length).toBeGreaterThan(1);
    });
  });
});

/** Method- and path-aware, because /agent-runs is both the list and the create route. */
function stubRunServer(sequence: Array<Record<string, unknown>>) {
  let call = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

      if (path === '/goals') return json(goals);
      if (path === '/credits') return json(rich);
      if (path === '/credits/pricing') return json(pricing);
      if (path === '/agent-runs' && init?.method === 'POST') return json(sequence[0]);
      if (path === '/agent-runs') return json({ runs: [] });
      // The detail advances through the sequence: that is how the test tells
      // "the page re-read the server" apart from "the page just painted what
      // the button suggested".
      const next = sequence[Math.min(++call, sequence.length - 1)];
      return json(next);
    }),
  );
}

const runPending = { id: 'run-1', taskType: 'propose-strategies', agentType: 'strategy-analyst', status: 'PENDING', input: { goalId: 'goal-1' }, output: null, error: null, model: null, createdAt: '2026-07-28T12:00:00.000Z', completedAt: null };
const runFailed = { ...runPending, status: 'FAILED', error: 'Not enough credits for this run' };

describe('ProposeStrategies — waiting', () => {
  it('shows that AUREA is working while the run is queued', async () => {
    stubRunServer([runPending, runPending]);

    renderWithProviders(<ProposeStrategies />);
    await userEvent.click(await screen.findByRole('button', { name: /propose strategies/i }));

    expect(await screen.findByText(/aurea is thinking/i)).toBeInTheDocument();
  });

  it('picks up a run that was already in flight when the page loaded', async () => {
    // A fifteen-second wait on a phone meets a reload often; losing the
    // result would be a real cost.
    stubFetch({
      '/goals': { body: goals },
      '/credits': { body: rich },
      '/credits/pricing': { body: pricing },
      '/agent-runs': { body: { runs: [runPending] } },
      '/agent-runs/run-1': { body: runPending },
    });

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText(/aurea is thinking/i)).toBeInTheDocument();
  });

  it('shows the server reason when the run fails', async () => {
    stubRunServer([runPending, runFailed]);

    renderWithProviders(<ProposeStrategies />);
    await userEvent.click(await screen.findByRole('button', { name: /propose strategies/i }));

    expect(await screen.findByText('Not enough credits for this run')).toBeInTheDocument();
  });

  it('recovers a run regardless of its status, including one that finished mid-reload', async () => {
    // The guarantee that matters here is the opposite of "recovers a pending
    // run": a naive "filter to RUNNING" recovery would pass the PENDING case
    // above identically, but would drop a run that already reached a
    // terminal status while the page was reloading — the exact case this
    // recovery exists for. Asserting on a FAILED run recovered with no click
    // is what would catch a regression back to status-filtered recovery.
    stubFetch({
      '/goals': { body: goals },
      '/credits': { body: rich },
      '/credits/pricing': { body: pricing },
      '/agent-runs': { body: { runs: [runFailed] } },
      '/agent-runs/run-1': { body: runFailed },
    });

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText('Not enough credits for this run')).toBeInTheDocument();
    expect(screen.queryByText(/aurea is thinking/i)).not.toBeInTheDocument();
  });

  it('shows the in-flight run even when the goal list fails to load', async () => {
    // The run's own state has to win over the goal-list state: a founder
    // reloading mid-run whose goal list happens to be erroring must still
    // see their run, not "Could not load this section" for a form that
    // is not even being offered right now.
    stubFetch({
      '/goals': { status: 500, body: { error: { code: 'INTERNAL', message: 'boom' } } },
      '/credits': { body: rich },
      '/credits/pricing': { body: pricing },
      '/agent-runs': { body: { runs: [runPending] } },
      '/agent-runs/run-1': { body: runPending },
    });

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText(/aurea is thinking/i)).toBeInTheDocument();
    expect(screen.queryByText('Could not load this section.')).not.toBeInTheDocument();
  });

  it(
    'stops polling once the run reaches a terminal status',
    async () => {
      // Nothing in a status-blind assertion (e.g. "the failed card shows up")
      // would catch a `refetchInterval` that kept firing forever afterwards —
      // the failed card would look identical either way. The regression is
      // caught by holding time still once the run is already terminal and
      // showing the request count does not grow.
      //
      // No `shouldAdvanceTime`: at a real 30s cadence, syncing the fake clock
      // to wall time would make this test actually take tens of seconds. The
      // clock is driven by hand instead, so the interval's magnitude never
      // costs real time.
      vi.useFakeTimers();

      let detailCalls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          const path = new URL(url).pathname;
          const json = (body: unknown) =>
            new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
          if (path === '/goals') return json(goals);
          if (path === '/credits') return json(rich);
          if (path === '/credits/pricing') return json(pricing);
          if (path === '/agent-runs') return json({ runs: [runPending] });
          detailCalls += 1;
          return json(runFailed);
        }),
      );

      renderWithProviders(<ProposeStrategies />);

      // Drains the recovery chain (list, then the detail poll it unlocks) —
      // react-query batches its own notifications, so draining every pending
      // timer is what walks all the way through it, not a single microtask
      // flush.
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('Not enough credits for this run')).toBeInTheDocument();
      const callsAtTerminal = detailCalls;

      // Comfortably past one more interval: a regression that kept polling
      // past a terminal status would show up as a second call here.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(40_000);
      });

      expect(detailCalls).toBe(callsAtTerminal);

      vi.useRealTimers();
    },
    15_000,
  );

  it(
    'stops polling when the poll itself starts failing, not only on a terminal status',
    async () => {
      // `query.state.data` never becomes truthy if the detail request itself
      // is what is failing (a 500, a deleted run, an expired session) — a
      // `refetchInterval` that only checks `state.data` would keep returning
      // 30000 forever, a request every 30s while the founder looks at an
      // error card. Same shape as the terminal test above: hold time still
      // once errored and show the request count stops growing, since a
      // status-blind assertion (e.g. "an error card shows up") cannot tell a
      // stopped poll apart from one that kept firing behind it.
      //
      // No `shouldAdvanceTime` — see the previous test.
      vi.useFakeTimers();

      let detailCalls = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          const path = new URL(url).pathname;
          const json = (body: unknown, status = 200) =>
            new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
          if (path === '/goals') return json(goals);
          if (path === '/credits') return json(rich);
          if (path === '/credits/pricing') return json(pricing);
          if (path === '/agent-runs') return json({ runs: [runPending] });
          // /agent-runs/run-1: fails every single time, persistently.
          detailCalls += 1;
          return json({ error: { code: 'INTERNAL', message: 'boom' } }, 500);
        }),
      );

      renderWithProviders(<ProposeStrategies />);

      // The test client has retries off, so the very first failed fetch is
      // already the terminal 'error' state. Draining every pending timer
      // walks through the dependent recovery chain (list, then detail).
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('That run did not finish.')).toBeInTheDocument();
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
});

const proposalOutput = {
  options: [
    { name: 'Founder-led outbound', strategicThesis: 'Ops leads answer a person.', growthMechanism: 'Outbound', expectedOutcome: 'Ten calls', channels: ['Email'], assumptions: ['They read email'], risks: ['Deliverability'], tradeoffs: 'Slower than paid.', hypotheses: [ { statement: 'Plain text wins', rationale: 'r', targetMetric: 'reply_rate', expectedOutcome: 'e', confidence: 'MEDIUM' }, { statement: 'Three touches beat one', rationale: 'r', targetMetric: 'reply_rate', expectedOutcome: 'e', confidence: 'LOW' } ] },
    { name: 'Content-led', strategicThesis: 'Ops leads search before they buy.', growthMechanism: 'Content', expectedOutcome: 'Ten calls', channels: ['SEO'], assumptions: ['They search'], risks: ['Slow'], tradeoffs: 'Compounds, but not this month.', hypotheses: [ { statement: 'Comparison pages convert', rationale: 'r', targetMetric: 'signup_rate', expectedOutcome: 'e', confidence: 'MEDIUM' }, { statement: 'Docs bring traffic', rationale: 'r', targetMetric: 'sessions', expectedOutcome: 'e', confidence: 'LOW' } ] },
  ],
  recommendedIndex: 0,
  rationale: 'Cheapest way to learn.',
};

const runDone = { ...runPending, status: 'COMPLETED', output: proposalOutput, completedAt: '2026-07-28T12:00:15.000Z' };

/**
 * A finished proposal, plus the two endpoints the review needs: the combined
 * draft the server builds for the editor, and the adoption itself.
 *
 * `draft` overrides let a test say what the combination came back as — the
 * merge itself is the server's, and its own tests live next to it.
 */
function proposalServer(calls?: StubFetchCall[], draft: Record<string, unknown> = {}) {
  void calls;
  return {
    '/goals': { body: goals },
    '/credits': { body: rich },
    '/credits/pricing': { body: pricing },
    '/agent-runs': { body: { runs: [runDone] } },
    '/agent-runs/run-1': { body: runDone },
    // Nenhuma opção adotada ainda: o deck mostra as duas.
    '/strategies/proposal-usage': { body: { usedOptionIndexes: [] } },
    '/strategies/from-proposal/run-1/draft': {
      body: {
        strategy: {
          name: 'Founder-led outbound',
          strategicThesis: 'Ops leads answer a person.',
          growthMechanism: 'Outbound',
          expectedOutcome: 'Ten calls',
          channels: ['Email'],
          assumptions: ['They read email'],
          risks: ['Deliverability'],
          hypotheses: [
            { statement: 'Plain text wins', rationale: 'r', targetMetric: 'reply_rate', expectedOutcome: 'e', confidence: 'MEDIUM' },
          ],
          ...draft,
        },
      },
    },
    '/strategies/from-proposal': { body: { strategy: { id: 'str-1', name: 'Founder-led outbound', status: 'DRAFT' } } },
  };
}

describe('ProposeStrategies — naming the goal a run is about', () => {
  it('names the goal while the run is still working', async () => {
    stubFetch({
      '/goals': { body: goals },
      '/credits': { body: rich },
      '/credits/pricing': { body: pricing },
      '/agent-runs': { body: { runs: [{ ...runPending, input: { goalId: 'goal-1' } }] } },
      '/agent-runs/run-1': { body: { ...runPending, input: { goalId: 'goal-1' } } },
    });

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText(/aurea is thinking/i)).toBeInTheDocument();
    expect(await screen.findByText(/Ten discovery calls/)).toBeInTheDocument();
  });

  it('names the goal on a failed run, and retries against that same goal — not the first one in the list', async () => {
    // Two ACTIVE goals: a single-goal fixture could not tell "resolved the
    // run's actual goal" apart from "fell back to actionable[0] and got
    // lucky", which is exactly the bug (a founder paying for a run about the
    // wrong goal because the button silently guessed).
    const calls: StubFetchCall[] = [];
    const runForGoal2 = { ...runFailed, input: { goalId: 'goal-2' } };
    stubFetch(
      {
        '/goals': { body: goalsTwo },
        '/credits': { body: rich },
        '/credits/pricing': { body: pricing },
        '/agent-runs': { body: { runs: [runForGoal2] } },
        '/agent-runs/run-1': { body: runForGoal2 },
      },
      calls,
    );

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText(/Cut CAC by 20%/)).toBeInTheDocument();
    // Never silently names or targets the other goal in the workspace.
    expect(screen.queryByText(/Ten discovery calls/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST' && call.path === '/agent-runs');
      expect(post?.body).toEqual({ taskType: 'propose-strategies', input: { goalId: 'goal-2' } });
    });
  });

  it('names the goal on an unreadable proposal', async () => {
    stubFetch({
      '/goals': { body: goals },
      '/credits': { body: rich },
      '/credits/pricing': { body: pricing },
      '/agent-runs': { body: { runs: [{ ...runDone, input: { goalId: 'goal-1' }, output: { options: 'nope' } }] } },
      '/agent-runs/run-1': { body: { ...runDone, input: { goalId: 'goal-1' }, output: { options: 'nope' } } },
    });

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument();
    expect(await screen.findByText(/Ten discovery calls/)).toBeInTheDocument();
  });

  it('names the recovered proposal\'s goal, and starting another run never fires against a different one', async () => {
    const calls: StubFetchCall[] = [];
    const runForGoal2 = { ...runDone, input: { goalId: 'goal-2' } };
    stubFetch(
      {
        '/goals': { body: goalsTwo },
        '/credits': { body: rich },
        '/credits/pricing': { body: pricing },
        '/agent-runs': { body: { runs: [runForGoal2] } },
        '/agent-runs/run-1': { body: runForGoal2 },
        '/strategies/proposal-usage': { body: { usedOptionIndexes: [] } },
      },
      calls,
    );

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText(/Cut CAC by 20%/)).toBeInTheDocument();
    expect(screen.queryByText(/Ten discovery calls/)).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: /start another run/i }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST' && call.path === '/agent-runs');
      expect(post?.body).toEqual({ taskType: 'propose-strategies', input: { goalId: 'goal-2' } });
    });
  });

  it('disables starting another run when the recovered run\'s goal cannot be resolved to a known goal', async () => {
    // Say nothing rather than a raw uuid, and refuse to fire rather than
    // guess — a deleted goal, or a run input from before this fix shipped,
    // must never let the button start a run against actionable[0] instead.
    const calls: StubFetchCall[] = [];
    const runForGhostGoal = { ...runDone, input: { goalId: 'ghost-goal' } };
    stubFetch(
      {
        '/goals': { body: goals },
        '/credits': { body: rich },
        '/credits/pricing': { body: pricing },
        '/agent-runs': { body: { runs: [runForGhostGoal] } },
        '/agent-runs/run-1': { body: runForGhostGoal },
        '/strategies/proposal-usage': { body: { usedOptionIndexes: [] } },
      },
      calls,
    );

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByRole('button', { name: /start another run/i })).toBeDisabled();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });
});

describe('ProposeStrategies — reviewing', () => {
  it('shows one plan at a time, opening on the recommendation', async () => {
    // Side by side, the options read as a wall and the choice read as
    // one-of-N-and-final. One card is one decision — and the deck opens on
    // AUREA's own reading, so having a recommendation is visible.
    stubFetch(proposalServer());

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText('Founder-led outbound')).toBeInTheDocument();
    expect(screen.getByText(/slower than paid/i)).toBeInTheDocument();
    expect(screen.getByText(copy('pages.strategies.propose.planPosition', { position: 1, total: 2 }))).toBeInTheDocument();
    // The other plan is behind the deck, not on screen.
    expect(screen.queryByText('Content-led')).not.toBeInTheDocument();
  });

  it('marks the recommendation as a recommendation, and ticks nothing', async () => {
    // The choice is human: a pre-selected option would be a decision made by
    // the agent, which is exactly what phase 05 does not allow.
    stubFetch(proposalServer());

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText(/recommended/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    // Nothing ticked means nothing to review yet.
    expect(screen.getByRole('button', { name: copy('pages.strategies.propose.reviewBtn') })).toBeDisabled();
  });

  it('walks to the other plan and ticks it', async () => {
    stubFetch(proposalServer());

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText('Founder-led outbound')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: new RegExp(copy('pages.strategies.propose.nextBtn')) }));

    expect(await screen.findByText('Content-led')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByText(copy('pages.strategies.propose.pickedCount', { picked: 1 }))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy('pages.strategies.propose.reviewBtn') })).toBeEnabled();
  });

  it('adopts the plan the founder reviewed, with the text they left in the form', async () => {
    // The proposal is a draft, not a decree: the founder knows the business,
    // and the old screen forced them to take the model's words or rewrite the
    // whole thing by hand afterwards.
    const calls: StubFetchCall[] = [];
    stubFetch(proposalServer(calls), calls);

    renderWithProviders(<ProposeStrategies />);

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: copy('pages.strategies.propose.reviewBtn') }));

    // The combined draft comes from the server, so the merge rule has one
    // implementation — the one that writes.
    const name = await screen.findByLabelText(copy('pages.strategies.propose.nameLabel'));
    expect(name).toHaveValue('Founder-led outbound');
    await userEvent.clear(name);
    await userEvent.type(name, 'Outbound, but only to ops leads');

    await userEvent.click(screen.getByRole('button', { name: copy('pages.strategies.propose.createBtn') }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST' && call.path === '/strategies/from-proposal');
      expect(post?.body).toMatchObject({
        agentRunId: 'run-1',
        optionIndexes: [0],
        strategy: { name: 'Outbound, but only to ops leads' },
      });
    });
  });

  it('combines two plans into one, and says which ones it is combining', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(proposalServer(calls, { name: 'Founder-led outbound + Content-led' }), calls);

    renderWithProviders(<ProposeStrategies />);

    await userEvent.click(await screen.findByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: new RegExp(copy('pages.strategies.propose.nextBtn')) }));
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: copy('pages.strategies.propose.combineBtn', { count: 2 }) }));

    expect(
      await screen.findByText(
        copy('pages.strategies.propose.combining', { names: 'Founder-led outbound + Content-led' }),
      ),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: copy('pages.strategies.propose.createBtn') }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST' && call.path === '/strategies/from-proposal');
      expect(post?.body).toMatchObject({ agentRunId: 'run-1', optionIndexes: [0, 1] });
    });
  });

  it('says so when the run output cannot be read as a proposal', async () => {
    stubFetch({
      '/goals': { body: goals },
      '/credits': { body: rich },
      '/credits/pricing': { body: pricing },
      '/agent-runs': { body: { runs: [{ ...runDone, output: { options: 'nope' } }] } },
      '/agent-runs/run-1': { body: { ...runDone, output: { options: 'nope' } } },
    });

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument();
  });

  it('offers a way to start another run once a proposal is showing, so the screen is not a dead end', async () => {
    // Recovery adopts the newest run regardless of status, so once a run
    // reaches COMPLETED the proposal branch would otherwise render forever on
    // every later visit, with no way to ask AUREA to propose again.
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/goals': { body: goals },
        '/credits': { body: rich },
        '/credits/pricing': { body: pricing },
        '/agent-runs': { body: { runs: [runDone] } },
        '/agent-runs/run-1': { body: runDone },
        '/strategies/proposal-usage': { body: { usedOptionIndexes: [] } },
      },
      calls,
    );

    renderWithProviders(<ProposeStrategies />);
    await userEvent.click(await screen.findByRole('button', { name: /start another run/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST' && call.path === '/agent-runs')).toBe(true);
    });
  });

  it('lets the founder retry from an unreadable proposal, not just from a fresh session', async () => {
    // `setRunId(null)` would only work in the same session that started the
    // run: a founder who reloaded onto an already-malformed run has
    // `runId === null` from the start, so that click would do nothing and
    // the same unreadable card would just re-render.
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/goals': { body: goals },
        '/credits': { body: rich },
        '/credits/pricing': { body: pricing },
        '/agent-runs': { body: { runs: [{ ...runDone, output: { options: 'nope' } }] } },
        '/agent-runs/run-1': { body: { ...runDone, output: { options: 'nope' } } },
      },
      calls,
    );

    renderWithProviders(<ProposeStrategies />);
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST' && call.path === '/agent-runs')).toBe(true);
    });
  });

  it('shows the idle form again once every option in the proposal has already been adopted', async () => {
    // Um plano combinado gasta todas as opções que entraram nele: com as duas
    // opções já adotadas não sobra nada para o deck oferecer, e a tela cai no
    // formulário de nova proposta — o mesmo texto/botão do primeiro acesso.
    stubFetch({ ...proposalServer(), '/strategies/proposal-usage': { body: { usedOptionIndexes: [0, 1] } } });

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByRole('button', { name: /propose strategies/i })).toBeInTheDocument();
    expect(screen.queryByText('Founder-led outbound')).not.toBeInTheDocument();
    expect(screen.queryByText('Content-led')).not.toBeInTheDocument();
  });

  it('does not render the deck while the usage query is still loading', async () => {
    // Renderizar todas as opções e removê-las depois de o uso responder seria
    // oferecer e retirar — a tela espera o uso antes de mostrar qualquer opção.
    let resolveUsage: (value: Response) => void = () => {};
    const usagePromise = new Promise<Response>((resolve) => {
      resolveUsage = resolve;
    });
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    const server = proposalServer() as Record<string, { body: unknown }>;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const path = new URL(url).pathname;
        if (path === '/strategies/proposal-usage') return usagePromise;
        const route = server[path];
        if (!route) throw new Error(`unstubbed ${path}`);
        return Promise.resolve(json(route.body));
      }),
    );

    renderWithProviders(<ProposeStrategies />);

    expect(await screen.findByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Founder-led outbound')).not.toBeInTheDocument();

    resolveUsage(json({ usedOptionIndexes: [] }));

    expect(await screen.findByText('Founder-led outbound')).toBeInTheDocument();
  });
});
