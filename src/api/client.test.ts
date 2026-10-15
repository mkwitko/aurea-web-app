import { afterEach, beforeEach, vi } from 'vitest';
import client, { ApiError } from './client';

// `client` reads the access token and the refresh function from
// `@/lib/api` — stub both so these tests exercise only the request/response
// plumbing (in particular `buildQuery`'s param serialization), not auth.
// Hoisted because `vi.mock`'s factory runs before module-level consts exist.
const auth = vi.hoisted(() => ({
  tokenStore: { access: null as string | null, clear: vi.fn() },
  workspaceStore: { id: null as string | null },
  refreshTokens: vi.fn(() => Promise.resolve(false)),
}));

vi.mock('@/lib/api', () => auth);

function stubFetchOnce() {
  const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(
      new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Pulls the query string off the URL the client actually requested. */
function requestedParams(fetchMock: ReturnType<typeof stubFetchOnce>): URLSearchParams {
  const [url] = fetchMock.mock.calls[0]!;
  return new URL(url).searchParams;
}

const assign = vi.fn();

beforeEach(() => {
  auth.tokenStore.access = null;
  auth.tokenStore.clear.mockClear();
  auth.workspaceStore.id = null;
  auth.refreshTokens.mockClear();
  assign.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Answers every request with a 401 carrying the backend's error envelope. */
function stubUnauthorized() {
  vi.stubGlobal('location', { assign, href: 'http://localhost/login' } as unknown as Location);
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { code: 'AUR-A0002', message: 'Invalid credentials' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
}

describe('api client 401 handling', () => {
  it('leaves the session alone when the request carried no token', async () => {
    // A rejected login is a 401, and it says nothing about the session — there
    // was none. Clearing tokens and redirecting here reloads the page out from
    // under the form, so the user never sees why the login failed. Only a
    // request that actually carried an Authorization header can be evidence of
    // a dead session.
    stubUnauthorized();

    await expect(client({ method: 'POST', url: '/auth/login', data: { email: 'a@b.c', password: 'wrong' } })).rejects.toBeInstanceOf(
      ApiError,
    );

    expect(assign).not.toHaveBeenCalled();
    expect(auth.tokenStore.clear).not.toHaveBeenCalled();
  });

  it('still ends the session when the request carried a token', async () => {
    // The other direction, asserted so neither can flip silently: an expired
    // access token that the refresh could not rescue does mean the session is
    // over, and the app has to stop pretending otherwise.
    auth.tokenStore.access = 'expired-token';
    stubUnauthorized();

    await expect(client({ method: 'GET', url: '/business' })).rejects.toBeInstanceOf(ApiError);

    expect(auth.refreshTokens).toHaveBeenCalled();
    expect(auth.tokenStore.clear).toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('hands the backend error body to the caller so it can be shown', async () => {
    // The thrown ApiError's own `message` is the synthetic "API 401
    // Unauthorized"; the message worth showing lives in the parsed body.
    stubUnauthorized();

    await expect(client({ method: 'POST', url: '/auth/login', data: {} })).rejects.toMatchObject({
      status: 401,
      data: { error: { code: 'AUR-A0002', message: 'Invalid credentials' } },
    });
  });
});

describe('api client param serialization', () => {
  it('serializes a Date param as its ISO 8601 string, not Date.prototype.toString()', async () => {
    const fetchMock = stubFetchOnce();

    await client({ method: 'GET', url: '/credits/ledger', params: { before: new Date('2026-07-20T12:00:00.000Z') } });

    expect(requestedParams(fetchMock).get('before')).toBe('2026-07-20T12:00:00.000Z');
  });

  it('leaves string, number and boolean params unchanged', async () => {
    const fetchMock = stubFetchOnce();

    await client({ method: 'GET', url: '/x', params: { q: 'hello', limit: 20, active: true } });

    const params = requestedParams(fetchMock);
    expect(params.get('q')).toBe('hello');
    expect(params.get('limit')).toBe('20');
    expect(params.get('active')).toBe('true');
  });

  it('omits undefined and null params instead of sending literal "undefined"/"null"', async () => {
    const fetchMock = stubFetchOnce();

    await client({ method: 'GET', url: '/x', params: { a: undefined, b: null, c: 1 } });

    const params = requestedParams(fetchMock);
    expect(params.has('a')).toBe(false);
    expect(params.has('b')).toBe(false);
    expect(params.get('c')).toBe('1');
  });
});

describe('api client workspace header', () => {
  it('sends no x-workspace-id when nothing has been picked yet', async () => {
    const fetchMock = stubFetchOnce();

    await client({ method: 'GET', url: '/business' });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(new Headers(init?.headers).has('x-workspace-id')).toBe(false);
  });

  it('sends the selected workspace on every request once one is picked', async () => {
    auth.workspaceStore.id = 'ws-123';
    const fetchMock = stubFetchOnce();

    await client({ method: 'GET', url: '/business' });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(new Headers(init?.headers).get('x-workspace-id')).toBe('ws-123');
  });
});
