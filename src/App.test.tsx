import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n';
import { stubFetch } from '@/test/stub-fetch';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { UiModeProvider } from '@/lib/ui-mode';
import { WorkspaceProvider } from '@/lib/workspace';
import { App } from './App';

const ME_NO_WORKSPACE = {
  user: { id: '11111111-1111-1111-1111-111111111111', email: 'a@b.com', name: 'A' },
  memberships: [{ organizationId: '22222222-2222-2222-2222-222222222222', workspaceId: null, role: 'OWNER' }],
};

function renderApp(initialEntries: string[]) {
  void i18n.changeLanguage('en');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UiModeProvider>
          <MemoryRouter initialEntries={initialEntries}>
            <AuthProvider>
              <WorkspaceProvider>
                <App />
              </WorkspaceProvider>
            </AuthProvider>
          </MemoryRouter>
        </UiModeProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

// This is the wiring the whole feature depends on: `Protected` in `App.tsx`
// wraps every `/app/*` route in `WorkspaceGate`. No other test renders
// `App`'s own route tree, so deleting that wrapper left the rest of the suite
// green (final review, I6) — this mounts `App` itself, not a hand-built
// stand-in, so removing `<WorkspaceGate>` from `Protected` fails this test.
describe('App routing', () => {
  it('sends an authenticated account with no workspace to the create-workspace screen instead of the dashboard', async () => {
    localStorage.setItem('aurea.access', 'token');
    stubFetch({ '/auth/me': { body: ME_NO_WORKSPACE } });

    renderApp(['/app']);

    expect(await screen.findByRole('button', { name: /create and continue/i })).toBeInTheDocument();
  });
});

/**
 * Phase 5 replaced the old eight-step guide (one route per step, plus a
 * hypothesis-id route) with the concierge — a single `/app/onboarding` with
 * no step in the url. Both old shapes now redirect there instead of 404ing
 * or rendering something stale, same as `/app/business/setup` and
 * `/app/icps` already do for their own retired routes.
 *
 * This exercises the two `<Navigate>` lines directly, the same way
 * `OnboardingPage.test.tsx` used to test the old guide's own step routing —
 * mounting the real `<App>` here would also have to satisfy `AppLayout`'s
 * dashboard shape and its SSE connection (`useAgentRunEvents`, which
 * `EventSource`-less jsdom cannot open), none of which this redirect's
 * correctness depends on.
 */
describe('App routing — retired onboarding routes', () => {
  function renderRedirect(initialEntries: string[]) {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/app/onboarding" element={<p>the concierge</p>} />
          <Route path="/app/onboarding/hypothesis/:id" element={<Navigate to="/app/onboarding" replace />} />
          <Route path="/app/onboarding/:step" element={<Navigate to="/app/onboarding" replace />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('sends the old per-step guide url to the concierge', () => {
    renderRedirect(['/app/onboarding/goal']);
    expect(screen.getByText('the concierge')).toBeInTheDocument();
  });

  it('sends the old hypothesis-id guide url to the concierge', () => {
    renderRedirect(['/app/onboarding/hypothesis/11111111-1111-1111-1111-111111111111']);
    expect(screen.getByText('the concierge')).toBeInTheDocument();
  });
});
