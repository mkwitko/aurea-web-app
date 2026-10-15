import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { meQueryKey } from '@/api/generated/hooks/authHooks/useMe';
import { AuthProvider, useAuth } from './auth';
import { tokenStore } from './api';
import { apiErrorMessage } from './api-errors';

function Probe({ onLoginError }: { onLoginError?: (message: string) => void }) {
  const { role, status, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="probe">
        {status}:{role ?? 'none'}
      </span>
      <button
        onClick={() =>
          void login('owner@acme.com', 'secret').catch((error: unknown) =>
            // Exactly what LoginPage does with a rejection, so the message the
            // user would read is what this asserts on.
            onLoginError?.(apiErrorMessage(error, 'generic fallback')),
          )
        }
      >
        login
      </button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

function renderProbe(onLoginError?: (message: string) => void) {
  // auth.tsx pins `retry: 1` on the query itself (per the ruling), which wins
  // over this client's default — so it's not the retry count we can zero out
  // here, only the delay between attempts, or the error test would need a
  // longer waitFor timeout than the default 1s.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe onLoginError={onLoginError} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

/** A minimal stand-in for the global `Response` the Kubb client reads from. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response;
}

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn((url: string) => Promise.resolve(handler(url)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AuthProvider role', () => {
  it('prefers the membership of the current workspace', async () => {
    tokenStore.set('access', 'refresh');
    stubFetch(() =>
      jsonResponse(200, {
        user: { id: 'u1', email: 'owner@acme.com', name: 'Owner' },
        memberships: [
          { organizationId: 'org-1', workspaceId: null, role: 'VIEWER' },
          { organizationId: 'org-1', workspaceId: 'ws-1', role: 'OWNER' },
        ],
      }),
    );

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('authenticated:OWNER'));
  });

  it('falls back to the organization membership', async () => {
    tokenStore.set('access', 'refresh');
    stubFetch(() =>
      jsonResponse(200, {
        user: { id: 'u1', email: 'admin@acme.com', name: 'Admin' },
        memberships: [{ organizationId: 'org-1', workspaceId: null, role: 'ADMIN' }],
      }),
    );

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('authenticated:ADMIN'));
  });

  it('has no role and makes no request while anonymous', async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, {}));

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('anonymous:none'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to anonymous and keeps the tokens when /auth/me fails', async () => {
    tokenStore.set('access', 'refresh');
    stubFetch(() => jsonResponse(500, { error: { code: 'INTERNAL', message: 'boom' } }));

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('anonymous:none'));
    expect(tokenStore.access).toBe('access');
    expect(tokenStore.refresh).toBe('refresh');
  });

  it('re-login after a background /auth/me failure never leaks the previous session', async () => {
    // Reproduces the exact reported setup: the user WAS authenticated (a
    // successful /auth/me already cached OWNER for org-1), then a later
    // background refetch hit a transient 500 — the deliberate no-clear case:
    // tokens stay put, but the cached query now holds old *data* alongside
    // an *error*. The user lands back on /login and signs in again without
    // ever calling logout(), so `hasToken` is already true throughout.
    tokenStore.set('access', 'refresh');

    const history: Array<{ status: string; role: string | null }> = [];
    function ReloginProbe() {
      const { role, status, login } = useAuth();
      history.push({ status, role });
      return (
        <div>
          <span data-testid="probe">
            {status}:{role ?? 'none'}
          </span>
          <button onClick={() => void login('new@acme.com', 'secret')}>login</button>
        </div>
      );
    }

    type MeMode = 'success-1' | 'fail' | 'pending';
    let meMode: MeMode = 'success-1';
    let resolvePendingMe: ((res: Response) => void) | undefined;

    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/auth/login')) {
        return Promise.resolve(
          jsonResponse(200, {
            user: { id: 'u2', email: 'new@acme.com', name: 'New' },
            tokens: { accessToken: 'access-2', refreshToken: 'refresh-2' },
          }),
        );
      }
      if (url.includes('/auth/me')) {
        if (meMode === 'success-1') {
          return Promise.resolve(
            jsonResponse(200, {
              user: { id: 'u1', email: 'owner@acme.com', name: 'Owner' },
              memberships: [{ organizationId: 'org-1', workspaceId: 'ws-1', role: 'OWNER' }],
            }),
          );
        }
        if (meMode === 'fail') return Promise.resolve(jsonResponse(500, { error: { code: 'INTERNAL', message: 'boom' } }));
        // 'pending': the post-login session read, held open under our control.
        return new Promise<Response>((resolve) => {
          resolvePendingMe = resolve;
        });
      }
      return Promise.resolve(jsonResponse(404, {}));
    });
    vi.stubGlobal('fetch', fetchMock);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ReloginProbe />
        </AuthProvider>
      </QueryClientProvider>,
    );

    // Prior session established: a genuine success, OWNER for org-1.
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('authenticated:OWNER'));

    // A background refetch now fails. The tokens are deliberately kept, but
    // the cached query is left holding old data (OWNER) alongside an error.
    meMode = 'fail';
    await queryClient.refetchQueries({ queryKey: meQueryKey() });
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('anonymous:none'));
    expect(tokenStore.access).toBe('access');

    // The user logs in again — as someone else — without ever logging out.
    meMode = 'pending';
    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    // While the new session read is in flight, this must read 'loading:none'
    // — never 'anonymous' (the reset-vs-invalidate bug) and never the old
    // OWNER role sitting behind it (the isSuccess-gating bug).
    await waitFor(() => {
      expect(resolvePendingMe).toBeDefined();
      expect(screen.getByTestId('probe')).toHaveTextContent('loading:none');
    });

    resolvePendingMe?.(
      jsonResponse(200, {
        user: { id: 'u2', email: 'new@acme.com', name: 'New' },
        memberships: [{ organizationId: 'org-2', workspaceId: 'ws-2', role: 'MEMBER' }],
      }),
    );

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('authenticated:MEMBER'));

    // At no point across the whole flow did a role appear alongside a
    // non-authenticated status (neither the stale OWNER nor anything else).
    const leaked = history.some((h) => h.role !== null && h.status !== 'authenticated');
    expect(leaked).toBe(false);
  });

  it('stores both tokens on a successful login', async () => {
    // Guard for the transport swap: whichever client issues the request, the
    // access AND refresh token have to land in the store — dropping the
    // refresh one would look fine until the access token expires 15 minutes
    // later and the session dies with nothing to rotate.
    stubFetch((url) => {
      if (url.includes('/auth/login')) {
        return jsonResponse(200, {
          user: { id: 'u1', email: 'owner@acme.com', name: 'Owner' },
          tokens: { accessToken: 'access-1', refreshToken: 'refresh-1' },
        });
      }
      return jsonResponse(200, {
        user: { id: 'u1', email: 'owner@acme.com', name: 'Owner' },
        memberships: [{ organizationId: 'org-1', workspaceId: 'ws-1', role: 'OWNER' }],
      });
    });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('anonymous:none'));

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('authenticated:OWNER'));
    expect(tokenStore.access).toBe('access-1');
    expect(tokenStore.refresh).toBe('refresh-1');
  });

  it('surfaces the backend message when a login is rejected, and touches nothing else', async () => {
    // What the user must end up reading is the backend's own message. The
    // pages get there through `apiErrorMessage`, which needs the error to
    // carry the parsed body — so the rejection has to be the generated
    // client's ApiError, not a hand-rolled one that only has a `.message`.
    // The rest of the assertions are the 401 trap: a rejected login must not
    // clear tokens or navigate, or the form would vanish before it could
    // report anything.
    const assign = vi.fn();
    vi.stubGlobal('location', { assign, href: 'http://localhost/login' } as unknown as Location);
    stubFetch(() => jsonResponse(401, { error: { code: 'AUR-A0002', message: 'Invalid credentials' } }));

    const messages: string[] = [];
    renderProbe((message) => messages.push(message));

    fireEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => expect(messages).toEqual(['Invalid credentials']));
    expect(screen.getByTestId('probe')).toHaveTextContent('anonymous:none');
    expect(tokenStore.access).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });

  it('signs the user out locally even when the logout request fails', async () => {
    // Revoking the refresh token server-side is best-effort: if that call
    // fails, the user still asked to be signed out, and leaving the tokens in
    // localStorage would keep them signed in on this device. The session read
    // must go too, or the next login on this tab could show the previous
    // user's memberships from cache.
    tokenStore.set('access', 'refresh');
    stubFetch((url) => {
      if (url.includes('/auth/logout')) return jsonResponse(500, { error: { code: 'INTERNAL', message: 'boom' } });
      return jsonResponse(200, {
        user: { id: 'u1', email: 'owner@acme.com', name: 'Owner' },
        memberships: [{ organizationId: 'org-1', workspaceId: 'ws-1', role: 'OWNER' }],
      });
    });

    renderProbe();
    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('authenticated:OWNER'));

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('anonymous:none'));
    expect(tokenStore.access).toBeNull();
    expect(tokenStore.refresh).toBeNull();
  });

  it('clears the role on logout', async () => {
    tokenStore.set('access', 'refresh');
    stubFetch((url) => {
      if (url.includes('/auth/logout')) return jsonResponse(204, undefined);
      return jsonResponse(200, {
        user: { id: 'u1', email: 'owner@acme.com', name: 'Owner' },
        memberships: [{ organizationId: 'org-1', workspaceId: 'ws-1', role: 'OWNER' }],
      });
    });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('authenticated:OWNER'));

    fireEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('anonymous:none'));
  });
});
