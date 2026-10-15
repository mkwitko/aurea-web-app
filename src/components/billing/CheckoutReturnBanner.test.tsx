import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { afterEach, vi } from 'vitest';
import i18n from '@/i18n';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { CheckoutReturnBanner } from './CheckoutReturnBanner';

// Reads the router's live query string so a test can assert the banner
// actually edited the URL, not just that it rendered as if it had. Shares
// the same MemoryRouter/location as the banner, so it re-renders whenever
// the banner calls `setSearchParams`.
function SearchParamsProbe() {
  const [params] = useSearchParams();
  return <span data-testid="search">{params.toString()}</span>;
}

// `renderWithProviders` (src/test/render.tsx) always starts the router at
// its default entry, so this test needs its own thin wrapper to control the
// URL the banner mounts with — the `?checkout=...` param is the whole point
// of what's under test here.
//
// Always wrapped in `StrictMode`, matching `src/main.tsx`: the "syncs
// exactly once" requirement is specifically about surviving React's
// deliberate double-invoke of a fresh effect in development, so the test
// has to actually put the component under that regime rather than assume
// the guard works. `probe` opts a test into asserting on the resulting
// query string via `SearchParamsProbe` above.
function renderAt(url: string, { probe = false }: { probe?: boolean } = {}) {
  void i18n.changeLanguage('en');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[url]}>
          <CheckoutReturnBanner />
          {probe && <SearchParamsProbe />}
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

const billingState = {
  plan: 'GROWTH',
  status: 'ACTIVE',
  currentPeriodEnd: '2026-08-28T00:00:00.000Z',
  hasSubscription: true,
  maxWorkspaces: 3,
  workspaceCount: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('CheckoutReturnBanner', () => {
  it('renders nothing without a checkout param', () => {
    const calls: StubFetchCall[] = [];
    stubFetch({}, calls);

    const { container } = renderAt('/app/settings/billing');

    expect(container).toBeEmptyDOMElement();
    expect(calls).toHaveLength(0);
  });

  it('syncs exactly once under StrictMode on success, reports confirmation, and drops checkout from the URL', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ '/billing/sync': { body: billingState } }, calls);

    renderAt('/app/settings/billing?checkout=success', { probe: true });

    expect(screen.getByText('Confirming your payment…')).toBeInTheDocument();
    expect(await screen.findByText(/Payment confirmed/)).toBeInTheDocument();

    // StrictMode (src/main.tsx wraps the real app in it) mounts, cleans up,
    // and re-mounts a fresh effect in development specifically to catch
    // side effects that aren't safe to run twice. Without the `arrived` ref
    // guard in CheckoutReturnBanner, this would be 2, not 1.
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.path).toBe('/billing/sync');

    // The param must be gone once the outcome settles, and the confirmation
    // must still be on screen once it is — a reload from here must not
    // replay the return, but the user should still see why the page looks
    // the way it does.
    expect(screen.getByTestId('search')).toHaveTextContent('');
    expect(screen.getByText(/Payment confirmed/)).toBeInTheDocument();
  });

  it('never calls the payment a failure when the sync fails, even once under StrictMode', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ '/billing/sync': { status: 500, body: { error: { code: 'AUR-T0016', message: 'nope' } } } }, calls);

    renderAt('/app/settings/billing?checkout=success');

    expect(await screen.findByText(/Payment received/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(calls).toHaveLength(1);
  });

  it('stops spinning and offers a refresh when the sync never answers', () => {
    // A hanging POST /billing/sync left the banner on "Confirming your
    // payment…" with a spinner that never stops — on the very screen the user
    // lands on straight after paying. Time out into the same state the failure
    // path uses: the charge may well have gone through, so the message must
    // not claim otherwise, and a refresh has to be within reach.
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => {})),
    );

    renderAt('/app/settings/billing?checkout=success');

    expect(screen.getByText('Confirming your payment…')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(screen.queryByText('Confirming your payment…')).not.toBeInTheDocument();
    expect(screen.getByText(/Payment received/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });

  it('says nothing was charged on cancel, does not sync, and drops checkout from the URL', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({}, calls);

    renderAt('/app/settings/billing?checkout=cancel', { probe: true });

    expect(screen.getByText('Checkout canceled. Nothing was charged.')).toBeInTheDocument();
    await waitFor(() => expect(calls).toHaveLength(0));

    expect(screen.getByTestId('search')).toHaveTextContent('');
    expect(screen.getByText('Checkout canceled. Nothing was charged.')).toBeInTheDocument();
  });
});
