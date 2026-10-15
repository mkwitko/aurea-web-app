import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { AuthProvider } from '@/lib/auth';
// AuthShell renders the theme toggle, so the page needs the theme context the
// real app gives it from main.tsx.
import { ThemeProvider } from '@/lib/theme';
import { WorkspaceProvider } from '@/lib/workspace';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { WorkspaceGate } from '@/components/WorkspaceGate';
import { WorkspaceNewPage } from './WorkspaceNewPage';

const ME_NO_WORKSPACE = {
  user: { id: '11111111-1111-1111-1111-111111111111', email: 'a@b.com', name: 'A' },
  memberships: [{ organizationId: '22222222-2222-2222-2222-222222222222', workspaceId: null, role: 'OWNER' }],
};

const CREATED = {
  id: '33333333-3333-3333-3333-333333333333',
  name: 'Acme',
  slug: 'acme-a1b2c3',
  createdAt: '2026-08-03T00:00:00.000Z',
};

const ME_HAS_WORKSPACE = {
  ...ME_NO_WORKSPACE,
  memberships: [{ organizationId: '22222222-2222-2222-2222-222222222222', workspaceId: CREATED.id, role: 'OWNER' }],
};

/**
 * Renders `WorkspaceNewPage` through the same routes `App.tsx` wires it into
 * — `ProtectedRoute` + `WorkspaceGate` around `/app`, `WorkspaceNewPage`
 * outside the gate at `/app/workspaces/new` — instead of standalone. Standalone
 * is what let I3/I4 stay green while C1 was live: with no route for
 * `navigate('/app')` to land on, `WorkspaceGate` to redirect through, the page
 * never unmounts and every state it *claims* to reach is reachable whether or
 * not the real flow would ever produce it.
 */
function renderRouteTree(initialEntries: string[]) {
  void i18n.changeLanguage('en');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            <WorkspaceProvider>
              <Routes>
                <Route
                  path="/app/workspaces/new"
                  element={
                    <ProtectedRoute>
                      <WorkspaceNewPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <WorkspaceGate>
                        <div>app shell</div>
                      </WorkspaceGate>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </WorkspaceProvider>
          </AuthProvider>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('WorkspaceNewPage', () => {
  it('posts the name and stores the new workspace as the active one', async () => {
    localStorage.setItem('aurea.access', 'token');
    const calls: StubFetchCall[] = [];
    // The refetch inside `confirmSession` needs `/auth/me` to actually report
    // the new membership on its second read — the first read (AuthProvider's
    // initial mount) still has none.
    stubFetch(
      {
        '/auth/me': [{ body: ME_NO_WORKSPACE }, { body: ME_HAS_WORKSPACE }],
        '/workspaces': { status: 201, body: CREATED },
      },
      calls,
    );

    renderWithProviders(
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <WorkspaceNewPage />
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>,
    );

    await userEvent.type(await screen.findByLabelText(/name/i), 'Acme');
    await userEvent.click(screen.getByRole('button', { name: /create and continue/i }));

    await waitFor(() => {
      expect(calls.some((c) => c.method === 'POST' && c.path === '/workspaces')).toBe(true);
    });
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'Acme' });
    await waitFor(() => expect(localStorage.getItem('aurea.workspaceId')).toBe(CREATED.id));
  });

  it('refuses to submit an empty name', async () => {
    localStorage.setItem('aurea.access', 'token');
    stubFetch({ '/auth/me': { body: ME_NO_WORKSPACE } });

    renderWithProviders(
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <WorkspaceNewPage />
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>,
    );

    expect(await screen.findByRole('button', { name: /create and continue/i })).toBeDisabled();
  });

  // Missing from the spec's frontend test list until now: the plan-cap and
  // VIEWER-403 copy exists because the page renders the backend's own words,
  // not generic copy — nothing proved that wiring worked.
  it('renders the backend refusal message when creation fails', async () => {
    localStorage.setItem('aurea.access', 'token');
    stubFetch({
      '/auth/me': { body: ME_NO_WORKSPACE },
      '/workspaces': {
        status: 403,
        body: { error: { code: 'AUR-T0017', message: 'Your plan allows up to 1 workspace. You already have 1.' } },
      },
    });

    renderWithProviders(
      <ThemeProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <WorkspaceNewPage />
          </WorkspaceProvider>
        </AuthProvider>
      </ThemeProvider>,
    );

    await userEvent.type(await screen.findByLabelText(/name/i), 'Acme');
    await userEvent.click(screen.getByRole('button', { name: /create and continue/i }));

    expect(await screen.findByText('Your plan allows up to 1 workspace. You already have 1.')).toBeInTheDocument();
    // Creation failed: nothing was created, so the form must still be there to retry.
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  // The route-tree version of the first test above: proves the whole
  // navigation actually lands, not just that the POST went out.
  it('creates the workspace, confirms the session, and lands on the app — posting exactly once', async () => {
    localStorage.setItem('aurea.access', 'token');
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/auth/me': [{ body: ME_NO_WORKSPACE }, { body: ME_HAS_WORKSPACE }],
        '/workspaces': { status: 201, body: CREATED },
      },
      calls,
    );

    renderRouteTree(['/app/workspaces/new']);

    await userEvent.type(await screen.findByLabelText(/name/i), 'Acme');
    await userEvent.click(screen.getByRole('button', { name: /create and continue/i }));

    expect(await screen.findByText('app shell')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST' && c.path === '/workspaces')).toHaveLength(1);
  });

  // O workspace já existe: reenviar criaria um segundo. A saída é tentar a
  // sessão de novo, nunca o POST — e desta vez a sessão relida de fato
  // termina reportando o workspace, então o retry precisa completar a
  // navegação sem um segundo POST.
  it('offers a session retry instead of a second submit when the session read is not yet caught up, and the retry finishes the flow', async () => {
    localStorage.setItem('aurea.access', 'token');
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        // Index 0: AuthProvider's initial read. Index 1: the refetch inside
        // `onSuccess`'s `confirmSession` — still no workspace, so the retry
        // state is what has to render. Index 2+: the refetch the retry
        // button triggers, which is what unblocks the flow.
        '/auth/me': [{ body: ME_NO_WORKSPACE }, { body: ME_NO_WORKSPACE }, { body: ME_HAS_WORKSPACE }],
        '/workspaces': { status: 201, body: CREATED },
      },
      calls,
    );

    renderRouteTree(['/app/workspaces/new']);

    await userEvent.type(await screen.findByLabelText(/name/i), 'Acme');
    await userEvent.click(screen.getByRole('button', { name: /create and continue/i }));

    expect(await screen.findByRole('button', { name: /^continue$/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/could not load your session/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(await screen.findByText('app shell')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST' && c.path === '/workspaces')).toHaveLength(1);
  });

  // M3: the page silently creating an Nth workspace for an account that
  // already has one is a real reachable bug (the route has no reverse
  // guard) — proved through the route tree so the redirect target is real.
  it('never shows the form to an account that already has a workspace', async () => {
    localStorage.setItem('aurea.access', 'token');
    stubFetch({ '/auth/me': { body: ME_HAS_WORKSPACE } });

    renderRouteTree(['/app/workspaces/new']);

    expect(await screen.findByText('app shell')).toBeInTheDocument();
    expect(screen.queryByLabelText(/name/i)).not.toBeInTheDocument();
  });
});
