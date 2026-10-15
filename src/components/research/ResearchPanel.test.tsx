import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { ResearchPanel } from './ResearchPanel';

/**
 * Resolves a copy key through the app's own i18n instance rather than
 * hard-coding the English string.
 *
 * `pages.research.*` does not exist yet — it lands in the next task — so
 * i18next currently returns the key itself for every one of these. Asserting
 * against `i18n.t(...)` means these assertions keep pointing at whatever the
 * component actually renders both before and after that copy exists: today
 * they pin the key, tomorrow they pin the sentence. Hard-coding either one
 * would break on the other.
 */
const copy = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options ?? {});

const goals = {
  goals: [{ id: 'goal-1', name: 'Ten discovery calls', metric: 'discovery_calls_booked', status: 'ACTIVE' }],
};
// Two ACTIVE goals: the fixture the "which goal does this button target" tests
// need, since a single-goal workspace can never tell "resolved the right goal"
// apart from "fell back to actionable[0] and got lucky".
const goalsTwo = {
  goals: [
    { id: 'goal-1', name: 'Ten discovery calls', metric: 'discovery_calls_booked', status: 'ACTIVE' },
    { id: 'goal-2', name: 'Cut CAC by 20%', metric: 'cac', status: 'ACTIVE' },
  ],
};
const pricing = { operations: [{ taskType: 'research-growth-context', credits: 5 }] };
const rich = { plan: 'GROWTH', allowance: 100, consumed: 0, purchasedBalance: 0, periodStart: '2026-07-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z' };
const broke = { ...rich, consumed: 98 };

const base = {
  '/goals': { body: goals },
  '/credits': { body: rich },
  '/credits/pricing': { body: pricing },
  '/agent-runs': { body: { runs: [] } },
};

const runPending = {
  id: 'run-1',
  taskType: 'research-growth-context',
  agentType: 'research-analyst',
  status: 'PENDING',
  input: { goalId: 'goal-1' },
  output: null,
  error: null,
  model: null,
  createdAt: '2026-07-29T12:00:00.000Z',
  completedAt: null,
};
const runFailed = { ...runPending, status: 'FAILED', error: 'Web search is not configured for this workspace' };

const researchOutput = {
  summary: 'Ops teams are consolidating tools, and onboarding cost is the first thing buyers compare.',
  findings: [
    {
      dimension: 'MARKET',
      statement: 'Demand for ops tooling grew through 2026.',
      evidence: 'Search interest rose 40% year over year.',
      sourceUrl: 'https://example.test/state-of-ops',
      sourceTitle: 'State of Ops 2026',
      confidence: 'MEDIUM',
      target: 'TREND',
    },
    {
      dimension: 'COMPETITOR',
      statement: 'Northwind bundles onboarding for free.',
      evidence: 'Their pricing page lists onboarding at no cost.',
      sourceUrl: 'https://northwind.test/pricing',
      sourceTitle: 'Northwind pricing',
      confidence: 'HIGH',
      target: 'COMPETITOR',
      competitor: { name: 'Northwind', strengths: ['Free onboarding'], weaknesses: ['Thin support'] },
    },
    {
      dimension: 'CUSTOMER',
      statement: 'Ops leads read newsletters on Tuesdays.',
      evidence: 'A survey of two hundred ops leads said so.',
      sourceUrl: 'https://example.test/survey',
      sourceTitle: 'Ops survey 2026',
      confidence: 'LOW',
      target: 'NONE',
    },
  ],
  opportunities: [
    {
      statement: 'Sell against bundled onboarding.',
      rationale: 'Buyers compare onboarding cost before they compare features.',
      supportingFindings: [1],
      confidence: 'MEDIUM',
    },
  ],
};

const runDone = {
  ...runPending,
  status: 'COMPLETED',
  output: researchOutput,
  completedAt: '2026-07-29T12:00:40.000Z',
};

/**
 * What `POST`/`DELETE /business/context/from-research` answer. `created` and
 * the skipped indexes are the server saying what it actually did — the accept
 * used to answer 201 with a fresh version even when it wrote nothing.
 */
const acceptedResult = {
  version: {
    id: 'ver-2',
    version: 2,
    data: {},
    source: 'RESEARCH',
    confidence: 'MEDIUM',
    createdAt: '2026-07-29T12:01:00.000Z',
    completeness: 60,
    incompleteSections: [],
  },
  created: true,
  skippedFindingIndexes: [],
  skippedOpportunityIndexes: [],
};

/** Nothing of this run is in the business context yet. */
const nothingKept = { presentFindingIndexes: [], presentOpportunityIndexes: [] };

/**
 * The four queries every branch of this panel needs, plus the run detail and
 * the deck's presence read — what the server says is already in the context.
 */
function serverWith(run: Record<string, unknown> | null, overrides: Record<string, { status?: number; body: unknown }> = {}) {
  return {
    '/goals': { body: goals },
    '/credits': { body: rich },
    '/credits/pricing': { body: pricing },
    '/agent-runs': { body: { runs: run ? [run] : [] } },
    ...(run ? { '/agent-runs/run-1': { body: run } } : {}),
    '/business/context/from-research/run-1': { body: nothingKept },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  // Defensive: if a fake-timers test fails before reaching its own
  // `vi.useRealTimers()`, later tests must not inherit a mocked clock.
  vi.useRealTimers();
});

describe('ResearchPanel — starting a run', () => {
  it('offers the run, and states what it costs, once everything it needs has loaded', async () => {
    stubFetch(base);

    renderWithProviders(<ResearchPanel />);

    // The cost line only renders once pricing has resolved, so blocking on it
    // is what makes the `toBeEnabled` assertion below mean anything: the button
    // starts out disabled (no goal yet, no recovery answer yet) either way.
    expect(await screen.findByText(copy('pages.research.cost', { credits: 5 }))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy('pages.research.startBtn') })).toBeEnabled();
  });

  it('refuses to start when the balance will not cover the run', async () => {
    // Guidance only — the worker still authorizes. The point is not making the
    // founder wait through a queue to be told no.
    stubFetch({ ...base, '/credits': { body: broke } });

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText(copy('pages.research.cost', { credits: 5 }))).toBeInTheDocument();

    expect(screen.getByRole('button', { name: copy('pages.research.startBtn') })).toBeDisabled();
    expect(screen.getByText(copy('pages.research.short'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy('pages.research.topUp') })).toHaveAttribute(
      'href',
      '/app/settings/billing',
    );
  });

  it('starts a run for the chosen goal', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(base, calls);

    renderWithProviders(<ResearchPanel />);

    await userEvent.click(await screen.findByRole('button', { name: copy('pages.research.startBtn') }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST');
      expect(post?.path).toBe('/agent-runs');
      expect(post?.body).toEqual({ taskType: 'research-growth-context', input: { goalId: 'goal-1' } });
    });
  });

  it('says so when there is no active goal to research', async () => {
    stubFetch({ ...base, '/goals': { body: { goals: [] } } });

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText(copy('pages.research.needGoal'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy('pages.research.startBtn') })).not.toBeInTheDocument();
  });

  it('shows a retryable error instead of a dead form when goals fail to load', async () => {
    stubFetch({ ...base, '/goals': { status: 500, body: { error: { code: 'INTERNAL', message: 'boom' } } } });

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText('Could not load this section.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy('pages.research.startBtn') })).not.toBeInTheDocument();
  });

  it('shows a retryable error instead of an enabled start button when the recovery query fails', async () => {
    // A founder who clicks through a failed recovery query risks paying for a
    // second run: the server only dedupes a run whose goal is identical.
    stubFetch({ ...base, '/agent-runs': { status: 500, body: { error: { code: 'INTERNAL', message: 'boom' } } } });

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText('Could not load this section.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy('pages.research.startBtn') })).not.toBeInTheDocument();
  });
});

describe('ResearchPanel — waiting', () => {
  it('shows that AUREA is working, and names the goal the run is about', async () => {
    stubFetch(serverWith(runPending));

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText(copy('pages.research.thinking'))).toBeInTheDocument();
    expect(
      await screen.findByText(copy('pages.research.forGoal', { name: 'Ten discovery calls' })),
    ).toBeInTheDocument();
  });

  it('shows the server reason when the run fails, not a generic message', async () => {
    stubFetch(serverWith(runFailed));

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText('Web search is not configured for this workspace')).toBeInTheDocument();
    expect(screen.queryByText(copy('pages.research.failed'))).not.toBeInTheDocument();
  });

  it('retries a failed run against that run\'s own goal, never the first in the list', async () => {
    const calls: StubFetchCall[] = [];
    const runForGoal2 = { ...runFailed, input: { goalId: 'goal-2' } };
    stubFetch(
      { ...serverWith(runForGoal2), '/goals': { body: goalsTwo } },
      calls,
    );

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText(copy('pages.research.forGoal', { name: 'Cut CAC by 20%' }))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: copy('pages.research.retryBtn') }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST' && call.path === '/agent-runs');
      expect(post?.body).toEqual({ taskType: 'research-growth-context', input: { goalId: 'goal-2' } });
    });
  });

  it('lets the founder leave a failed run for the picker, and research a different goal', async () => {
    // The bug this pins: recovery adopts the newest run whatever its status, so
    // a founder whose last run was FAILED/CANCELLED got that card on every
    // visit — and both buttons on it fire against that run's own goal. Their
    // other ACTIVE goals were unreachable, because the picker only renders when
    // no run is adopted.
    const calls: StubFetchCall[] = [];
    const runForGoal2 = { ...runFailed, input: { goalId: 'goal-2' } };
    stubFetch({ ...serverWith(runForGoal2), '/goals': { body: goalsTwo } }, calls);

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText(copy('pages.research.forGoal', { name: 'Cut CAC by 20%' }))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: copy('pages.research.newResearchBtn') }));

    // Leaving costs nothing: the escape is a state change, not a run.
    expect(calls.some((call) => call.method === 'POST')).toBe(false);

    const startBtn = await screen.findByRole('button', { name: copy('pages.research.startBtn') });
    await userEvent.click(startBtn);

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST' && call.path === '/agent-runs');
      expect(post?.body).toEqual({ taskType: 'research-growth-context', input: { goalId: 'goal-1' } });
    });
  });

  it(
    'stops polling once the run reaches a terminal status',
    async () => {
      // A status-blind assertion ("the failed card shows up") would look
      // identical whether or not `refetchInterval` kept firing forever
      // afterwards. The regression this guards is caught by holding time
      // still once the run is already terminal and showing the request count
      // does not grow. The counter increments unconditionally, before any
      // branch: a counter that only counted "interesting" calls is exactly
      // how the same regression slipped through once already on the
      // strategies screen.
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
          // The list and the detail read the same row: a run that is terminal
          // for the detail poll is terminal for the list poll too. Answering
          // PENDING here while the detail says FAILED would keep the list
          // polling forever — correctly, since a pending run is worth watching.
          if (path === '/agent-runs') return json({ runs: [runFailed] });
          detailCalls += 1;
          return json(runFailed);
        }),
      );

      renderWithProviders(<ResearchPanel />);

      // Drains the recovery chain (list, then the detail poll it unlocks) —
      // react-query batches its own notifications, so draining every pending
      // timer is what walks all the way through it, not a single microtask
      // flush.
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(screen.getByText('Web search is not configured for this workspace')).toBeInTheDocument();
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
      // `query.state.data` never becomes truthy if the detail request itself is
      // what is failing (a 500, a deleted run, an expired session), so a
      // `refetchInterval` that only checked `state.data` would keep returning
      // 30000 forever — a request every 30s behind an error card.
      //
      // No `shouldAdvanceTime` here either — see the previous test.
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
          detailCalls += 1;
          return json({ error: { code: 'INTERNAL', message: 'boom' } }, 500);
        }),
      );

      renderWithProviders(<ResearchPanel />);

      // The test client has retries off, so the very first failed fetch is
      // already the terminal 'error' state. Advanced by a hand-picked slice
      // rather than `runAllTimersAsync`: the list here answers with a PENDING
      // run, and watching a pending run is exactly what the list poll is for —
      // so its interval never drains, by design. This walks the dependent
      // recovery chain (list, then the detail it unlocks) and no further.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      expect(screen.getByText(copy('pages.research.failed'))).toBeInTheDocument();
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

/**
 * Renders the panel and waits for the deck's first card. Every review test
 * needs the same three round trips (goals, the recovered run, the presence
 * read) before anything is on screen.
 */
async function findFirstCard() {
  renderWithProviders(<ResearchPanel />);
  return screen.findByText('Demand for ops tooling grew through 2026.');
}

/** The forward arrow, matched loosely: the label sits next to a chevron icon. */
const nextBtn = () => screen.getByRole('button', { name: new RegExp(copy('pages.research.nextBtn')) });

describe('ResearchPanel — reviewing what was found', () => {
  it('shows the summary and one card at a time, saying where in the deck it is', async () => {
    // The old screen stacked all three findings and the opportunity as a
    // checkbox list, and read as a wall: nothing said how many claims there
    // were or which one was being judged. One card is one decision.
    stubFetch(serverWith(runDone));

    expect(await findFirstCard()).toBeInTheDocument();
    expect(screen.getByText(/Ops teams are consolidating tools/)).toBeInTheDocument();
    expect(screen.getByText(copy('pages.research.findingPosition', { position: 1, total: 3 }))).toBeInTheDocument();
    // The other findings are behind the deck, not on screen.
    expect(screen.queryByText('Northwind bundles onboarding for free.')).not.toBeInTheDocument();
  });

  it('walks the deck forward and back', async () => {
    stubFetch(serverWith(runDone));

    await findFirstCard();
    // Nowhere to go back to from the first card.
    expect(screen.getByRole('button', { name: new RegExp(copy('pages.research.prevBtn')) })).toBeDisabled();

    await userEvent.click(nextBtn());
    expect(await screen.findByText('Northwind bundles onboarding for free.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: new RegExp(copy('pages.research.prevBtn')) }));
    expect(await screen.findByText('Demand for ops tooling grew through 2026.')).toBeInTheDocument();
  });

  it('reaches the opportunity at the end of the deck, and counts it separately', async () => {
    stubFetch(serverWith(runDone));

    await findFirstCard();
    await userEvent.click(nextBtn());
    await userEvent.click(nextBtn());
    await userEvent.click(nextBtn());

    expect(await screen.findByText('Sell against bundled onboarding.')).toBeInTheDocument();
    expect(
      screen.getByText(copy('pages.research.opportunityPosition', { position: 1, total: 1 })),
    ).toBeInTheDocument();
    expect(nextBtn()).toBeDisabled();
  });

  it('offers no way to keep a finding that belongs nowhere, and says why', async () => {
    stubFetch(serverWith(runDone));

    await findFirstCard();
    await userEvent.click(nextBtn());
    await userEvent.click(nextBtn());

    expect(await screen.findByText('Ops leads read newsletters on Tuesdays.')).toBeInTheDocument();
    expect(screen.getByText(copy('pages.research.notFiled'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy('pages.research.acceptLabel') })).not.toBeInTheDocument();
  });

  it('keeps the card on screen by index, and moves on to the next one', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(serverWith(runDone, { '/business/context/from-research': { body: acceptedResult } }), calls);

    await findFirstCard();
    await userEvent.click(screen.getByRole('button', { name: copy('pages.research.acceptLabel') }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST' && call.path === '/business/context/from-research');
      expect(post?.body).toEqual({ agentRunId: 'run-1', findingIndexes: [0], opportunityIndexes: [] });
    });
    // Saving and staying put would make the founder navigate again for every
    // single card.
    expect(await screen.findByText('Northwind bundles onboarding for free.')).toBeInTheDocument();
  });

  it('marks what the server says is already kept, and offers to take it back out', async () => {
    // The complaint that started this: a founder who reopened the page found
    // every card offering "keep this" again, with no way to tell an unsaved
    // finding from one already in their context — and no way to undo a mistake.
    const calls: StubFetchCall[] = [];
    stubFetch(
      serverWith(runDone, {
        '/business/context/from-research/run-1': { body: { presentFindingIndexes: [0], presentOpportunityIndexes: [] } },
        '/business/context/from-research': { body: acceptedResult },
      }),
      calls,
    );

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText(copy('pages.research.savedBadge'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy('pages.research.acceptLabel') })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: copy('pages.research.removeBtn') }));

    await waitFor(() => {
      const sent = calls.find((call) => call.method === 'DELETE');
      expect(sent?.path).toBe('/business/context/from-research');
      expect(sent?.body).toEqual({ agentRunId: 'run-1', findingIndexes: [0], opportunityIndexes: [] });
    });
  });

  it('saves everything still missing in one click, leaving out the unfilable and the already-kept', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      serverWith(runDone, {
        '/business/context/from-research/run-1': { body: { presentFindingIndexes: [0], presentOpportunityIndexes: [] } },
        '/business/context/from-research': { body: acceptedResult },
      }),
      calls,
    );

    renderWithProviders(<ResearchPanel />);

    // Finding 0 is already kept and finding 2 is NONE, so two of the four cards
    // are left: the competitor and the opportunity.
    await userEvent.click(await screen.findByRole('button', { name: copy('pages.research.saveAllBtn', { remaining: 2 }) }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST' && call.path === '/business/context/from-research');
      expect(post?.body).toEqual({ agentRunId: 'run-1', findingIndexes: [1], opportunityIndexes: [0] });
    });
  });

  it('has nothing left to offer once everything filable is kept', async () => {
    stubFetch(
      serverWith(runDone, {
        '/business/context/from-research/run-1': {
          body: { presentFindingIndexes: [0, 1], presentOpportunityIndexes: [0] },
        },
      }),
    );

    renderWithProviders(<ResearchPanel />);

    // No disabled "save the 0 remaining" button: an off button is noise where
    // an answer belongs.
    expect(await screen.findByText(copy('pages.research.allKept'))).toBeInTheDocument();
    expect(screen.getByText(copy('pages.research.savedCount', { saved: 3, total: 3 }))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /remaining/ })).not.toBeInTheDocument();
  });

  it('shows the server reason when a save fails, instead of a silent no-op', async () => {
    stubFetch(
      serverWith(runDone, {
        '/business/context/from-research': {
          status: 400,
          body: { error: { code: 'BAD_REQUEST', message: 'That finding is not in this research' } },
        },
      }),
    );

    await findFirstCard();
    await userEvent.click(screen.getByRole('button', { name: copy('pages.research.acceptLabel') }));

    expect(await screen.findByText('That finding is not in this research')).toBeInTheDocument();
  });

  it('offers a way to start another run, so a finished run is not a dead end', async () => {
    // Recovery adopts the newest run regardless of status, so without this the
    // review branch would render forever on every later visit.
    const calls: StubFetchCall[] = [];
    const runForGoal2 = { ...runDone, input: { goalId: 'goal-2' } };
    stubFetch({ ...serverWith(runForGoal2), '/goals': { body: goalsTwo } }, calls);

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText(copy('pages.research.forGoal', { name: 'Cut CAC by 20%' }))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: copy('pages.research.startAnotherBtn') }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST' && call.path === '/agent-runs');
      expect(post?.body).toEqual({ taskType: 'research-growth-context', input: { goalId: 'goal-2' } });
    });
  });

  it('refuses to start another run when the recovered run\'s goal cannot be resolved', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(serverWith({ ...runDone, input: { goalId: 'ghost-goal' } }), calls);

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByRole('button', { name: copy('pages.research.startAnotherBtn') })).toBeDisabled();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('says so when the run output cannot be read as research, and offers a way forward', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(serverWith({ ...runDone, output: { summary: 'ok', findings: 'nope' } }), calls);

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText(copy('pages.research.unreadable'))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: copy('pages.research.retryBtn') }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST' && call.path === '/agent-runs')).toBe(true);
    });
  });

  it('does not carry the review across a run change', async () => {
    // `activeId` is `runId ?? recovered`, and `recovered` can change with no
    // click from the founder: the recovery query refetches on reconnect, and
    // any invalidation of the agent-runs key does the same. A card position —
    // or worse, a save — is a set of *indexes into this run's findings*, and
    // index 0 of the next run is a different claim entirely.
    const runTwo = {
      ...runDone,
      id: 'run-2',
      createdAt: '2026-07-29T13:00:00.000Z',
      output: {
        ...researchOutput,
        findings: [
          {
            dimension: 'TREND',
            statement: 'Buyers now expect self-serve trials.',
            evidence: 'Four of five vendors surveyed ship one.',
            sourceUrl: 'https://example.test/trials',
            sourceTitle: 'Trials report 2026',
            confidence: 'HIGH',
            target: 'TREND',
          },
        ],
        opportunities: [],
      },
    };
    // `stubFetch` reads its routes map on every call, so mutating an entry
    // afterwards is how the same endpoint answers differently over time.
    const routes: Record<string, { status?: number; body: unknown }> = {
      '/goals': { body: goals },
      '/credits': { body: rich },
      '/credits/pricing': { body: pricing },
      '/agent-runs': { body: { runs: [runDone] } },
      '/agent-runs/run-1': { body: runDone },
      '/agent-runs/run-2': { body: runTwo },
      '/business/context/from-research/run-1': { body: nothingKept },
      '/business/context/from-research/run-2': { body: nothingKept },
    };
    stubFetch(routes);

    const { queryClient } = renderWithProviders(<ResearchPanel />);

    // Walk off the first card, so a deck that survived the run change would be
    // caught sitting on a position that does not exist in the new run.
    expect(await screen.findByText('Demand for ops tooling grew through 2026.')).toBeInTheDocument();
    await userEvent.click(nextBtn());
    expect(await screen.findByText('Northwind bundles onboarding for free.')).toBeInTheDocument();

    routes['/agent-runs'] = { body: { runs: [runTwo] } };
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: [{ url: '/agent-runs' }] });
    });

    // The newer run is on screen, from its first card.
    expect(await screen.findByText('Buyers now expect self-serve trials.')).toBeInTheDocument();
    expect(screen.getByText(copy('pages.research.findingPosition', { position: 1, total: 1 }))).toBeInTheDocument();
  });

  it('never reports a still-running run as unreadable', async () => {
    // A PENDING/RUNNING run's `output` is null; running that through the schema
    // and showing the unreadable card would accuse the agent of failing while
    // it is still working.
    stubFetch(serverWith(runPending));

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText(copy('pages.research.thinking'))).toBeInTheDocument();
    expect(screen.queryByText(copy('pages.research.unreadable'))).not.toBeInTheDocument();
  });
});

describe('ResearchPanel — several researches at once', () => {
  // The screen used to adopt exactly one run — the newest — and gave no way to
  // reach any other: researching a second goal meant losing sight of the first,
  // and an in-flight run took over the whole panel until it finished. The
  // backend never had that limit (concurrency is keyed per task + input, so two
  // goals never block each other); this was only ever a limit of the screen.
  const runOther = {
    ...runPending,
    id: 'run-2',
    status: 'RUNNING',
    input: { goalId: 'goal-2' },
    createdAt: '2026-07-29T13:00:00.000Z',
  };

  const twoRuns = {
    '/goals': { body: goalsTwo },
    '/credits': { body: rich },
    '/credits/pricing': { body: pricing },
    // Newest first, as the API orders it.
    '/agent-runs': { body: { runs: [runOther, runDone] } },
    '/agent-runs/run-1': { body: runDone },
    '/agent-runs/run-2': { body: runOther },
    '/business/context/from-research/run-1': { body: nothingKept },
    '/business/context/from-research/run-2': { body: nothingKept },
  };

  it('lists every research with its goal and its state', async () => {
    stubFetch(twoRuns);

    renderWithProviders(<ResearchPanel />);

    expect(await screen.findByText(copy('pages.research.runsLabel'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cut CAC by 20%/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ten discovery calls/ })).toBeInTheDocument();
    expect(screen.getByText(copy('pages.research.runStatus.running'))).toBeInTheDocument();
    expect(screen.getByText(copy('pages.research.runStatus.ready'))).toBeInTheDocument();
  });

  it('switches to another research, in flight or finished, without losing the others', async () => {
    stubFetch(twoRuns);

    renderWithProviders(<ResearchPanel />);

    // The newest run is the one adopted on arrival, and it is still thinking…
    expect(await screen.findByText(copy('pages.research.thinking'))).toBeInTheDocument();
    // …which is no longer a wall: the founder is told the others are reachable.
    expect(screen.getByText(copy('pages.research.meanwhile'))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Ten discovery calls/ }));

    // The finished research is now under review, and both tabs are still there.
    expect(await screen.findByText('Demand for ops tooling grew through 2026.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cut CAC by 20%/ })).toBeInTheDocument();
  });

  it('starts a research for another goal while one is still running', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        ...twoRuns,
        '/agent-runs/run-3': { body: { ...runPending, id: 'run-3', input: { goalId: 'goal-1' } } },
      },
      calls,
    );

    renderWithProviders(<ResearchPanel />);

    await userEvent.click(await screen.findByRole('button', { name: copy('pages.research.newResearchBtn') }));

    // The picker is a place, not the absence of a run: the tabs stay.
    const goalField = await screen.findByRole('button', { name: /Cut CAC by 20%/ });
    expect(goalField).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: copy('pages.research.startBtn') }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST' && call.path === '/agent-runs');
      // `goal-1` is the first ACTIVE goal, and the run in flight is about
      // `goal-2` — starting this one is not blocked by it.
      expect(post?.body).toEqual({ taskType: 'research-growth-context', input: { goalId: 'goal-1' } });
    });
  });
});
