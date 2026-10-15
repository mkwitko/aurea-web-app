import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { LedgerSection } from './LedgerSection';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

// `nextCursor` is a real createdAt timestamp in production (the API coerces
// it with `z.coerce.date()`), not an opaque token — using a real ISO string
// here (rather than a label like "cursor-2") means `new Date(cursor)` in the
// component behaves exactly as it would against the real API instead of
// relying on how leniently a JS engine happens to parse a non-date string.
const page1 = {
  entries: [
    { id: 'e1', kind: 'DEBIT', credits: 12, agentRunId: 'run-1', reason: 'goal.research', createdAt: '2026-07-28T12:00:00.000Z' },
    { id: 'e2', kind: 'GRANT', credits: 1_000, agentRunId: null, reason: 'plan upgrade STARTER→GROWTH', createdAt: '2026-07-26T12:00:00.000Z' },
  ],
  nextCursor: '2026-07-26T12:00:00.000Z',
};

const page2 = {
  entries: [
    { id: 'e3', kind: 'PURCHASE', credits: 500, agentRunId: null, reason: 'pack MEDIUM', createdAt: '2026-07-20T12:00:00.000Z' },
    { id: 'e4', kind: 'REFUND', credits: 12, agentRunId: 'run-9', reason: 'run failed', createdAt: '2026-07-19T12:00:00.000Z' },
  ],
  nextCursor: null,
};

/**
 * `stubFetch` matches by pathname only, so it can't tell page 1 from page 2 —
 * both hit `/credits/ledger`, differing only in the `before` query string.
 * This section paginates by query string, so a one-off fetch spy switches on
 * that param instead. Scoped to this test file only; the shared helper's
 * pathname-only matching stays untouched for `CreditsSection.test.tsx` and
 * `PlanSection.test.tsx`.
 */
function stubLedgerPages() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const parsed = new URL(url);
      const body = parsed.searchParams.get('before') ? page2 : page1;
      return Promise.resolve(jsonResponse(body));
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LedgerSection', () => {
  it('lists the entries with their kind and amount', async () => {
    stubFetch({ '/credits/ledger': { body: page1 } });

    renderWithProviders(<LedgerSection />);

    expect(await screen.findByText('goal.research')).toBeInTheDocument();
    expect(screen.getByText('Spent')).toBeInTheDocument();
    expect(screen.getByText('-12')).toBeInTheDocument();
    expect(screen.getByText('Granted')).toBeInTheDocument();
    expect(screen.getByText('+1000')).toBeInTheDocument();
  });

  it('appends the next page and then hides the button', async () => {
    stubLedgerPages();

    renderWithProviders(<LedgerSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('pack MEDIUM')).toBeInTheDocument();
    expect(screen.getByText('goal.research')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows the loading state first, not the empty table, then teaches once the first page resolves empty', async () => {
    // A plain `findByText` on the empty copy would pass even if the loading
    // gate were deleted and the empty card rendered immediately — assert the
    // loading state is what's on screen *before* the fetch settles, by
    // controlling exactly when it resolves.
    let resolveFetch: (response: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal('fetch', vi.fn(() => pending));

    renderWithProviders(<LedgerSection />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText(/Every agent run will show up/)).not.toBeInTheDocument();

    resolveFetch(jsonResponse({ entries: [], nextCursor: null }));

    expect(await screen.findByText(/Every agent run will show up/)).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('recovers once retried after a first-page load failure', async () => {
    stubFetch({
      '/credits/ledger': { status: 500, body: { error: { code: 'AUR-T9999', message: 'boom' } } },
    });

    renderWithProviders(<LedgerSection />);

    expect(await screen.findByText('Could not load this section.')).toBeInTheDocument();

    stubFetch({ '/credits/ledger': { body: page1 } });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('goal.research')).toBeInTheDocument();
    expect(screen.queryByText('Could not load this section.')).not.toBeInTheDocument();
  });

  it('keeps page-1 rows and offers a retry when the next page fails to load, then appends it on retry', async () => {
    // First request (no `before`) always succeeds with page 1. Every
    // request carrying `before` (i.e. "load more") fails once, then
    // succeeds with page 2 — so retry must re-request the SAME cursor, not
    // restart from page 1.
    let beforeAttempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const parsed = new URL(url);
        if (!parsed.searchParams.get('before')) return Promise.resolve(jsonResponse(page1));
        beforeAttempts += 1;
        if (beforeAttempts === 1) {
          return Promise.resolve(jsonResponse({ error: { code: 'AUR-T9999', message: 'boom' } }, 500));
        }
        return Promise.resolve(jsonResponse(page2));
      }),
    );

    renderWithProviders(<LedgerSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('Could not load this section.')).toBeInTheDocument();
    // Page 1's rows must still be on screen — a failed "load more" cannot
    // wipe out what already loaded.
    expect(screen.getByText('goal.research')).toBeInTheDocument();
    expect(screen.getByText('plan upgrade STARTER→GROWTH')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('pack MEDIUM')).toBeInTheDocument();
    expect(screen.queryByText('Could not load this section.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('leaves nothing clickable that would repeat a retry already in flight', async () => {
    // Guards the invariant, not a fix: a retry button left live during its own
    // refetch would let a double click fire the same page request twice. It
    // holds for two reasons that both have to keep holding — refetching clears
    // `isError`, so the error card (whose button is unconditional) is gone
    // while the request runs, and what replaces it is disabled by `isFetching`.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let laterPageCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (!new URL(url).searchParams.get('before')) return jsonResponse(page1);
        laterPageCalls += 1;
        if (laterPageCalls === 1) return jsonResponse({ error: { code: 'AUR-T9999', message: 'boom' } }, 500);
        // The retry is held open so the in-flight window is observable.
        await held;
        return jsonResponse(page2);
      }),
    );

    renderWithProviders(<LedgerSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    // Nothing on screen can ask for that page again: no retry button is left,
    // and the "load more" that took its place is disabled.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Load more' })).toBeDisabled());
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    for (const button of screen.getAllByRole('button')) await userEvent.click(button);
    expect(laterPageCalls).toBe(2);

    release();
    expect(await screen.findByText('pack MEDIUM')).toBeInTheDocument();
  });

  it('does not duplicate a row that reappears on a later page', async () => {
    // Page 2 repeats e2 from page 1 (simulating an overlap between pages,
    // e.g. a refetch of page 1 racing with "load more") alongside one truly
    // new row.
    const overlappingPage2 = {
      entries: [
        {
          id: 'e2',
          kind: 'GRANT',
          credits: 1_000,
          agentRunId: null,
          reason: 'plan upgrade STARTER→GROWTH',
          createdAt: '2026-07-26T12:00:00.000Z',
        },
        { id: 'e5', kind: 'PURCHASE', credits: 300, agentRunId: null, reason: 'pack SMALL', createdAt: '2026-07-15T12:00:00.000Z' },
      ],
      nextCursor: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const parsed = new URL(url);
        const body = parsed.searchParams.get('before') ? overlappingPage2 : page1;
        return Promise.resolve(jsonResponse(body));
      }),
    );

    renderWithProviders(<LedgerSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByText('pack SMALL')).toBeInTheDocument();
    expect(screen.getAllByText('plan upgrade STARTER→GROWTH')).toHaveLength(1);
    // e1, e2, e5 — three rows, not four, even though e2 arrived twice.
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('keeps newest-first order when the two pages interleave by createdAt', async () => {
    const orderedPage1 = {
      entries: [
        { id: 'a', kind: 'DEBIT', credits: 1, agentRunId: null, reason: 'entry-a', createdAt: '2026-07-28T00:00:00.000Z' },
        { id: 'b', kind: 'DEBIT', credits: 1, agentRunId: null, reason: 'entry-b', createdAt: '2026-07-20T00:00:00.000Z' },
      ],
      nextCursor: '2026-07-20T00:00:00.000Z',
    };
    // entry-c's createdAt falls BETWEEN entry-a and entry-b, even though it
    // arrives on page 2 — a naive concat of "page 1 then page 2" would put
    // it after entry-b instead of between entry-a and entry-b.
    const orderedPage2 = {
      entries: [
        { id: 'c', kind: 'DEBIT', credits: 1, agentRunId: null, reason: 'entry-c', createdAt: '2026-07-24T00:00:00.000Z' },
        { id: 'd', kind: 'DEBIT', credits: 1, agentRunId: null, reason: 'entry-d', createdAt: '2026-07-10T00:00:00.000Z' },
      ],
      nextCursor: null,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const parsed = new URL(url);
        const body = parsed.searchParams.get('before') ? orderedPage2 : orderedPage1;
        return Promise.resolve(jsonResponse(body));
      }),
    );

    renderWithProviders(<LedgerSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    await screen.findByText('entry-d');

    const tags = ['entry-a', 'entry-b', 'entry-c', 'entry-d'];
    const order = screen
      .getAllByRole('listitem')
      .map((item) => tags.find((tag) => item.textContent?.includes(tag)));

    expect(order).toEqual(['entry-a', 'entry-c', 'entry-b', 'entry-d']);
  });
});
