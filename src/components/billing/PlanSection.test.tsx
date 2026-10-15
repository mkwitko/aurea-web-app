import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { PlanSection } from './PlanSection';

const billing = {
  plan: 'GROWTH',
  status: 'ACTIVE',
  currentPeriodEnd: '2026-08-28T00:00:00.000Z',
  hasSubscription: true,
  maxWorkspaces: 3,
  workspaceCount: 1,
};

const plans = {
  plans: [
    { plan: 'STARTER', monthlyCredits: 200, maxWorkspaces: 1, priceCents: 29_700, currency: 'BRL' },
    { plan: 'GROWTH', monthlyCredits: 1_000, maxWorkspaces: 3, priceCents: 99_700, currency: 'BRL' },
    { plan: 'SCALE', monthlyCredits: 4_000, maxWorkspaces: 10, priceCents: 249_700, currency: 'BRL' },
  ],
  packs: [],
};

let role: string | null = 'OWNER';
vi.mock('@/lib/auth', () => ({ useAuth: () => ({ role }) }));

const assign = vi.fn();

beforeEach(() => {
  role = 'OWNER';
  assign.mockClear();
  vi.stubGlobal('location', { assign, href: 'http://localhost/app/settings/billing' } as unknown as Location);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PlanSection', () => {
  it('shows the current plan, its status and the renewal date', async () => {
    stubFetch({ '/billing': { body: billing }, '/billing/plans': { body: plans } });

    renderWithProviders(<PlanSection />);

    expect(await screen.findByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Current plan')).toBeInTheDocument();
    expect(screen.getByText(/Renews on/)).toBeInTheDocument();
  });

  it('marks no plan as current while on trial', async () => {
    // `Organization.plan` defaults to STARTER with status TRIAL, so GET /billing
    // reports STARTER for an organization that never subscribed. Badging it
    // "Current plan" tells the user they are on a paid plan they are not on —
    // and hides that plan's action, so they cannot even subscribe to it.
    stubFetch({
      '/billing': {
        body: { ...billing, plan: 'STARTER', status: 'TRIAL', hasSubscription: false, currentPeriodEnd: null },
      },
      '/billing/plans': { body: plans },
    });

    renderWithProviders(<PlanSection />);

    expect(await screen.findByText('Trial')).toBeInTheDocument();
    expect(screen.queryByText('Current plan')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Subscribe' })).toHaveLength(3);
  });

  it('lets a canceled organization resubscribe to the plan it had', async () => {
    // The plan column keeps the last plan after cancellation, so the same badge
    // would hide the only action that brings the subscription back.
    stubFetch({
      '/billing': { body: { ...billing, plan: 'GROWTH', status: 'CANCELED' } },
      '/billing/plans': { body: plans },
    });

    renderWithProviders(<PlanSection />);

    expect(await screen.findByText('Canceled')).toBeInTheDocument();
    expect(screen.queryByText('Current plan')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Subscribe' })).toHaveLength(3);
  });

  it('sends an owner with no subscription to Stripe checkout to create one', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/billing': { body: { ...billing, status: 'TRIAL', hasSubscription: false, currentPeriodEnd: null } },
        '/billing/plans': { body: plans },
        '/billing/checkout/subscription': { body: { url: 'https://checkout.stripe/x' } },
        '/billing/subscription/plan': { body: billing },
      },
      calls,
    );

    renderWithProviders(<PlanSection />);
    // GROWTH is the current plan in the fixture, so STARTER and SCALE offer the
    // action; the first one is STARTER.
    const subscribeButtons = await screen.findAllByRole('button', { name: 'Subscribe' });
    await userEvent.click(subscribeButtons[0]!);

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe/x'));
    expect(calls).toContainEqual({ method: 'POST', path: '/billing/checkout/subscription', body: { plan: 'STARTER' } });
    // The change route needs a subscription to change; calling it here would 409.
    expect(calls.filter((call) => call.path === '/billing/subscription/plan')).toHaveLength(0);
  });

  it('switches a live subscriber in place instead of opening a second checkout', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/billing': { body: billing },
        '/billing/plans': { body: plans },
        '/billing/checkout/subscription': { body: { url: 'https://checkout.stripe/x' } },
        '/billing/subscription/plan': { body: { ...billing, plan: 'STARTER' } },
      },
      calls,
    );

    renderWithProviders(<PlanSection />);
    const switchButtons = await screen.findAllByRole('button', { name: 'Switch to this plan' });
    await userEvent.click(switchButtons[0]!);

    await waitFor(() =>
      expect(calls).toContainEqual({ method: 'POST', path: '/billing/subscription/plan', body: { plan: 'STARTER' } }),
    );
    // A Checkout Session in subscription mode can only *create* a subscription:
    // using it here would leave the organization paying for two.
    expect(calls.filter((call) => call.path === '/billing/checkout/subscription')).toHaveLength(0);
    // Stripe applies the proration inline and the route answers with the new
    // billing state, so there is nothing to redirect to.
    expect(assign).not.toHaveBeenCalled();
    // …but the cached billing state is now stale, so it has to be refetched.
    await waitFor(() =>
      expect(calls.filter((call) => call.path === '/billing' && call.method === 'GET')).toHaveLength(2),
    );
  });

  it('confirms the change once the new plan is applied', async () => {
    stubFetch({
      '/billing': { body: billing },
      '/billing/plans': { body: plans },
      '/billing/subscription/plan': { body: { ...billing, plan: 'STARTER' } },
    });

    renderWithProviders(<PlanSection />);
    const switchButtons = await screen.findAllByRole('button', { name: 'Switch to this plan' });
    await userEvent.click(switchButtons[0]!);

    expect(await screen.findByText('Plan changed. The new allowance is already available.')).toBeInTheDocument();
  });

  it('reports a rejected plan change instead of pretending it worked', async () => {
    // AUR-T0019: the subscription stopped being changeable between the page
    // load and the click (canceled in the Stripe portal in another tab).
    stubFetch({
      '/billing': { body: billing },
      '/billing/plans': { body: plans },
      '/billing/subscription/plan': { status: 409, body: { error: { code: 'AUR-T0019', message: 'no subscription' } } },
    });

    renderWithProviders(<PlanSection />);
    const switchButtons = await screen.findAllByRole('button', { name: 'Switch to this plan' });
    await userEvent.click(switchButtons[0]!);

    expect(await screen.findByText('Could not start that action. Try again in a moment.')).toBeInTheDocument();
    expect(screen.queryByText('Plan changed. The new allowance is already available.')).not.toBeInTheDocument();
  });

  it('sends a canceled subscriber back through checkout', async () => {
    // Cancelling only sets the status: `stripeSubscriptionId` stays, so
    // `hasSubscription` is still true. Routing on it would hit the change
    // route, get a 409, and leave the organization unable to resubscribe.
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/billing': { body: { ...billing, status: 'CANCELED' } },
        '/billing/plans': { body: plans },
        '/billing/checkout/subscription': { body: { url: 'https://checkout.stripe/x' } },
        '/billing/subscription/plan': { body: billing },
      },
      calls,
    );

    renderWithProviders(<PlanSection />);
    const subscribeButtons = await screen.findAllByRole('button', { name: 'Subscribe' });
    await userEvent.click(subscribeButtons[0]!);

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://checkout.stripe/x'));
    expect(calls.filter((call) => call.path === '/billing/subscription/plan')).toHaveLength(0);
  });

  it('locks the plan actions while a change is in flight', async () => {
    // `stubFetch` answers instantly, which is exactly when a pending guard is
    // invisible: the mutation settles before a second click can land. Hold the
    // change response open so the in-flight window is observable — a second
    // proration is a second charge, so the guard has to be real, not incidental.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const bodies: Record<string, unknown> = {
      '/billing': billing,
      '/billing/plans': plans,
      '/billing/subscription/plan': { ...billing, plan: 'STARTER' },
    };
    const calls: StubFetchCall[] = [];
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
        if (path === '/billing/subscription/plan') await held;
        return new Response(JSON.stringify(bodies[path]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    renderWithProviders(<PlanSection />);
    const switchButtons = await screen.findAllByRole('button', { name: 'Switch to this plan' });
    await userEvent.click(switchButtons[0]!);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Switch to this plan' })[0]!).toBeDisabled());
    // The other plan's action is locked too: switching twice mid-flight would
    // send two updates to the same subscription.
    await userEvent.click(screen.getAllByRole('button', { name: 'Switch to this plan' })[1]!);
    expect(calls.filter((call) => call.path === '/billing/subscription/plan')).toHaveLength(1);

    release();
    expect(await screen.findByText('Plan changed. The new allowance is already available.')).toBeInTheDocument();
  });

  it('retries both queries at once instead of one after the other', async () => {
    // Same shape as CreditsSection: the two queries are independent, so a slow
    // /billing must not hold the catalog request back while the user waits on
    // an error card.
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
        // Both fail on the first pass to put the error card up; on the retry,
        // /billing is held open so a chained catalog refetch never happens.
        if (calls.filter((call) => call === path).length === 1) {
          return new Response(JSON.stringify({ error: { code: 'AUR-T9999', message: 'boom' } }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          });
        }
        if (path === '/billing') await held;
        const bodies: Record<string, unknown> = { '/billing': billing, '/billing/plans': plans };
        return new Response(JSON.stringify(bodies[path]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    renderWithProviders(<PlanSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(calls.filter((call) => call === '/billing/plans')).toHaveLength(2));

    release();
    expect(await screen.findByText('Current plan')).toBeInTheDocument();
  });

  it('clears the previous result when the next action starts', async () => {
    // "Plan changed." still on screen under an in-flight switch reads as if the
    // new plan were already applied. Worse on the other paths: a failure
    // message survives into the next attempt, so a retry that is still running
    // looks like it already failed.
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let planChanges = 0;
    const bodies: Record<string, unknown> = {
      '/billing': billing,
      '/billing/plans': plans,
      '/billing/subscription/plan': { ...billing, plan: 'STARTER' },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = new URL(url).pathname;
        // Only the second change is held open: the first has to settle so the
        // success message is on screen before the next click.
        if (path === '/billing/subscription/plan') {
          planChanges += 1;
          if (planChanges > 1) await held;
        }
        return new Response(JSON.stringify(bodies[path]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    renderWithProviders(<PlanSection />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Switch to this plan' }))[0]!);
    expect(await screen.findByText('Plan changed. The new allowance is already available.')).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Switch to this plan' })[1]!);

    await waitFor(() =>
      expect(screen.queryByText('Plan changed. The new allowance is already available.')).not.toBeInTheDocument(),
    );
    release();
  });

  it('opens the billing portal', async () => {
    stubFetch({
      '/billing': { body: billing },
      '/billing/plans': { body: plans },
      '/billing/portal': { body: { url: 'https://portal.stripe/x' } },
    });

    renderWithProviders(<PlanSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Manage billing' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://portal.stripe/x'));
  });

  it('warns a past-due organization without taking the allowance away', async () => {
    stubFetch({
      '/billing': { body: { ...billing, status: 'PAST_DUE' } },
      '/billing/plans': { body: plans },
    });

    renderWithProviders(<PlanSection />);

    expect(await screen.findByText('Payment overdue')).toBeInTheDocument();
    expect(screen.getByText(/allowance stays for now/)).toBeInTheDocument();
  });

  it('explains an unconfigured billing environment instead of a generic failure', async () => {
    stubFetch({
      '/billing': { body: billing },
      '/billing/plans': { body: plans },
      '/billing/portal': { status: 500, body: { error: { code: 'AUR-T0016', message: 'not configured' } } },
    });

    renderWithProviders(<PlanSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Manage billing' }));

    expect(await screen.findByText('Billing is not available in this environment.')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it('disables plan actions and the portal for a member', async () => {
    role = 'MEMBER';
    stubFetch({ '/billing': { body: billing }, '/billing/plans': { body: plans } });

    renderWithProviders(<PlanSection />);

    expect(await screen.findByRole('button', { name: 'Manage billing' })).toBeDisabled();
    // hasSubscription is true in this fixture, so both non-current plan cards
    // (STARTER and SCALE) render "Switch to this plan" rather than
    // "Subscribe" — assert on the label the component actually produces, and
    // check every such button, not just one.
    const switchButtons = screen.getAllByRole('button', { name: 'Switch to this plan' });
    expect(switchButtons).toHaveLength(2);
    for (const button of switchButtons) expect(button).toBeDisabled();
  });

  it('surfaces a generic failure message for a non-AUR-T0016 error, and clears it on a later success', async () => {
    stubFetch({
      '/billing': { body: billing },
      '/billing/plans': { body: plans },
      '/billing/portal': { status: 500, body: { error: { code: 'AUR-T9999', message: 'boom' } } },
    });

    renderWithProviders(<PlanSection />);
    await userEvent.click(await screen.findByRole('button', { name: 'Manage billing' }));

    expect(await screen.findByText('Could not start that action. Try again in a moment.')).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();

    // The card is retried and the same action now succeeds — the earlier
    // failure message must not linger once it does.
    stubFetch({
      '/billing': { body: billing },
      '/billing/plans': { body: plans },
      '/billing/portal': { body: { url: 'https://portal.stripe/x' } },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Manage billing' }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://portal.stripe/x'));
    expect(screen.queryByText('Could not start that action. Try again in a moment.')).not.toBeInTheDocument();
  });

  it('explains the portal action differently for an owner and a member', async () => {
    stubFetch({ '/billing': { body: billing }, '/billing/plans': { body: plans } });

    const { unmount } = renderWithProviders(<PlanSection />);
    const ownerPortalButton = await screen.findByRole('button', { name: 'Manage billing' });
    // Scoped to the portal button's own container: a MEMBER also sees the
    // same "Who can change the plan" copy next to every disabled plan card
    // action, so an unscoped query would match more than one element.
    const ownerContainer = within(ownerPortalButton.parentElement as HTMLElement);
    expect(ownerContainer.getByLabelText('Explain: Billing portal')).toBeInTheDocument();
    unmount();

    role = 'MEMBER';
    renderWithProviders(<PlanSection />);
    const memberPortalButton = await screen.findByRole('button', { name: 'Manage billing' });
    const memberContainer = within(memberPortalButton.parentElement as HTMLElement);
    expect(memberContainer.getByLabelText('Explain: Who can change the plan')).toBeInTheDocument();
  });
});
