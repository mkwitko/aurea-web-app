import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { CreditsSection } from './CreditsSection';

const credits = {
  plan: 'GROWTH',
  allowance: 1_000,
  consumed: 400,
  purchasedBalance: 850,
  periodStart: '2026-07-28T00:00:00.000Z',
  periodEnd: '2026-08-28T00:00:00.000Z',
};

const catalog = {
  plans: [],
  packs: [
    { packId: 'SMALL', credits: 100, priceCents: 19_700, currency: 'BRL' },
    { packId: 'MEDIUM', credits: 500, priceCents: 79_700, currency: 'BRL' },
    { packId: 'LARGE', credits: 2_000, priceCents: 249_700, currency: 'BRL' },
  ],
};

let role: string | null = 'ADMIN';
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ role }) }));

const assign = vi.fn();

beforeEach(() => {
  role = 'ADMIN';
  assign.mockClear();
  vi.stubGlobal('location', { assign, href: 'http://localhost/app/settings/billing' } as unknown as Location);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CreditsSection', () => {
  it('shows the allowance, the purchased balance and what is available', async () => {
    stubFetch({ '/credits': { body: credits }, '/billing/plans': { body: catalog } });

    renderWithProviders(<CreditsSection />);

    expect(await screen.findByText('400 of 1000 used')).toBeInTheDocument();
    expect(screen.getByText('850')).toBeInTheDocument();
    expect(screen.getByText('1450')).toBeInTheDocument();
  });

  it('sends an admin to Stripe for the chosen pack', async () => {
    // `stubFetch`'s route map only picks a response by pathname, so it can't
    // by itself distinguish "sent packId: MEDIUM" from "sent packId: SMALL"
    // or nothing at all — every one of those would still hit the same
    // stubbed URL and get the same fixed checkout URL back. Capture the
    // actual requests so the assertion below checks the real request body,
    // not just that *a* checkout call happened.
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/credits': { body: credits },
        '/billing/plans': { body: catalog },
        '/billing/checkout/credits': { body: { url: 'https://checkout.stripe/pack' } },
      },
      calls,
    );

    renderWithProviders(<CreditsSection />);
    // catalog.packs[1] is MEDIUM.
    const buy = await screen.findAllByRole('button', { name: 'Buy' });
    await userEvent.click(buy[1]!);

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe/pack'));

    const checkoutCall = calls.find((call) => call.path === '/billing/checkout/credits');
    expect(checkoutCall?.method).toBe('POST');
    expect(checkoutCall?.body).toEqual({ packId: 'MEDIUM' });
  });

  it('disables buying for a member and explains why, but not for a role that can buy', async () => {
    role = 'MEMBER';
    stubFetch({ '/credits': { body: credits }, '/billing/plans': { body: catalog } });

    const { unmount } = renderWithProviders(<CreditsSection />);

    for (const button of await screen.findAllByRole('button', { name: 'Buy' })) {
      expect(button).toBeDisabled();
    }
    // A disabled action alone doesn't meet the requirement — there must also
    // be a keyboard-reachable explanation of why, one per disabled pack card.
    expect(screen.getAllByLabelText('Explain: Who can buy credits')).toHaveLength(3);
    unmount();

    role = 'ADMIN';
    stubFetch({ '/credits': { body: credits }, '/billing/plans': { body: catalog } });
    renderWithProviders(<CreditsSection />);

    for (const button of await screen.findAllByRole('button', { name: 'Buy' })) {
      expect(button).not.toBeDisabled();
    }
    expect(screen.queryByLabelText('Explain: Who can buy credits')).not.toBeInTheDocument();
  });

  it('hides the allowance bar on trial instead of drawing a full one', async () => {
    // TRIAL and CANCELED get a zero allowance from the backend
    // (`effectiveAllowance`), and a zero allowance drew a 100%-wide bar
    // labelled "0 of 0 used" — which reads as a full allowance. There is no
    // allowance to chart: what the trial has is the welcome grant, and that
    // shows up in the balances below.
    stubFetch({
      '/credits': { body: { ...credits, allowance: 0, consumed: 0, purchasedBalance: 50 } },
      '/billing/plans': { body: catalog },
    });

    renderWithProviders(<CreditsSection />);

    expect(await screen.findByText('Available now')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText('0 of 0 used')).not.toBeInTheDocument();
    expect(screen.queryByText('Monthly allowance')).not.toBeInTheDocument();
    // With a zero allowance, "available now" collapses to the purchased
    // balance itself (allowanceRemaining is 0), so "50" legitimately renders
    // twice — once as the purchased balance, once as what's available. A
    // plain getByText('50') is ambiguous here, so assert both occurrences.
    expect(screen.getAllByText('50')).toHaveLength(2);
  });

  it('explains an unconfigured billing environment instead of a generic failure', async () => {
    stubFetch({
      '/credits': { body: credits },
      '/billing/plans': { body: catalog },
      '/billing/checkout/credits': { status: 500, body: { error: { code: 'AUR-T0016', message: 'not configured' } } },
    });

    renderWithProviders(<CreditsSection />);
    const buy = await screen.findAllByRole('button', { name: 'Buy' });
    await userEvent.click(buy[1]!);

    expect(await screen.findByText('Billing is not available in this environment.')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('surfaces a generic failure message for a non-AUR-T0016 error, and clears it on a later success', async () => {
    stubFetch({
      '/credits': { body: credits },
      '/billing/plans': { body: catalog },
      '/billing/checkout/credits': { status: 500, body: { error: { code: 'AUR-T9999', message: 'boom' } } },
    });

    renderWithProviders(<CreditsSection />);
    const buy = await screen.findAllByRole('button', { name: 'Buy' });
    await userEvent.click(buy[1]!);

    expect(await screen.findByText('Could not start that action. Try again in a moment.')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();

    // The card is retried and the same action now succeeds — the earlier
    // failure message must not linger once it does.
    stubFetch({
      '/credits': { body: credits },
      '/billing/plans': { body: catalog },
      '/billing/checkout/credits': { body: { url: 'https://checkout.stripe/pack' } },
    });
    await userEvent.click(screen.getAllByRole('button', { name: 'Buy' })[1]!);

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe/pack'));
    expect(screen.queryByText('Could not start that action. Try again in a moment.')).not.toBeInTheDocument();
  });

  it('clears the previous failure while the retry is still in flight', async () => {
    // The failure message belongs to the attempt that failed. Left on screen
    // under a running retry it says the retry has already failed too, so the
    // user gives up on a purchase that may still be about to succeed.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let attempts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        if (path === '/billing/checkout/credits') {
          attempts += 1;
          // First attempt fails outright; the second is held open so the
          // in-flight window is observable.
          if (attempts === 1) {
            return new Response(JSON.stringify({ error: { code: 'AUR-T9999', message: 'boom' } }), {
              status: 500,
              headers: { 'content-type': 'application/json' },
            });
          }
          await held;
        }
        const bodies: Record<string, unknown> = {
          '/credits': credits,
          '/billing/plans': catalog,
          '/billing/checkout/credits': { url: 'https://checkout.stripe/pack' },
        };
        return new Response(JSON.stringify(bodies[path]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    renderWithProviders(<CreditsSection />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Buy' }))[1]!);
    expect(await screen.findByText('Could not start that action. Try again in a moment.')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Buy' })[1]!);

    await waitFor(() =>
      expect(screen.queryByText('Could not start that action. Try again in a moment.')).not.toBeInTheDocument(),
    );
    release();
  });

  it('retries both queries at once instead of one after the other', async () => {
    // Chaining the two refetches makes the user wait for the sum of them while
    // staring at an error card, and nothing orders one against the other. A
    // slow /credits must not hold the catalog request back.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        calls.push(path);
        const failed = calls.filter((call) => call === path).length === 1;
        // Both fail on the first pass to put the error card on screen; on the
        // retry, /credits is held open so a chained catalog refetch would never
        // be issued.
        if (failed) {
          return new Response(JSON.stringify({ error: { code: 'AUR-T9999', message: 'boom' } }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (path === '/credits') await held;
        const bodies: Record<string, unknown> = { '/credits': credits, '/billing/plans': catalog };
        return new Response(JSON.stringify(bodies[path]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    renderWithProviders(<CreditsSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(calls.filter((call) => call === '/billing/plans')).toHaveLength(2));

    release();
    expect(await screen.findByText('400 of 1000 used')).toBeInTheDocument();
  });

  it('recovers once the catalog is retried, not just credits', async () => {
    // `/credits` succeeds but `/billing/plans` fails: the error branch fires
    // on `credits.isError || catalog.isError`, so "Try again" has to refetch
    // *both* queries — refetching only `credits` would leave `catalog`
    // permanently errored and the section stuck on the error card forever.
    stubFetch({
      '/credits': { body: credits },
      '/billing/plans': { status: 500, body: { error: { code: 'AUR-T9999', message: 'boom' } } },
    });

    renderWithProviders(<CreditsSection />);

    expect(await screen.findByText('Could not load this section.')).toBeInTheDocument();

    stubFetch({ '/credits': { body: credits }, '/billing/plans': { body: catalog } });
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('400 of 1000 used')).toBeInTheDocument();
    expect(screen.queryByText('Could not load this section.')).not.toBeInTheDocument();
  });
});
