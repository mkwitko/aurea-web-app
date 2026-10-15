import { vi } from 'vitest';

/** One recorded request, captured when a `calls` sink is passed to {@link stubFetch}. */
export type StubFetchCall = { method: string; path: string; body: unknown };

type StubResponse = { status?: number; body: unknown };

/**
 * A route may answer once (the existing shape) or answer differently across
 * successive calls to the same path — an array is consumed in order, and the
 * last entry repeats once exhausted. That is what a test needs to prove a
 * session read changes between a first and a later call (e.g. no workspace,
 * then a workspace) without mocking the hook itself.
 */
type StubRoute = StubResponse | StubResponse[];

/**
 * Stubs `global.fetch` with a fixed map of pathname -> response, for tests
 * that exercise the generated Kubb hooks against `src/api/client.ts` rather
 * than mocking the hooks themselves. Throws on any path not in the map so a
 * missing route fails loudly instead of hanging the request.
 *
 * Pass `calls` (an array the test owns) to also record every request made
 * while the stub is active — method, pathname and parsed JSON body — for
 * tests that need to assert *what* was sent, not just that a success/error
 * response was handled. Optional and additive: existing callers that only
 * pass `routes` are unaffected.
 */
export function stubFetch(routes: Record<string, StubRoute>, calls?: StubFetchCall[]): void {
  const callCounts: Record<string, number> = {};
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const route = routes[path];
      if (!route) throw new Error(`unstubbed ${path}`);
      const sequence = Array.isArray(route) ? route : [route];
      if (sequence.length === 0) throw new Error(`empty stub route for ${path}`);
      const index = callCounts[path] ?? 0;
      callCounts[path] = index + 1;
      const hit = sequence[Math.min(index, sequence.length - 1)] ?? sequence[sequence.length - 1];
      if (!hit) throw new Error(`empty stub route for ${path}`);
      if (calls) {
        const rawBody = init?.body;
        calls.push({
          method: init?.method ?? 'GET',
          path,
          body: typeof rawBody === 'string' ? (JSON.parse(rawBody) as unknown) : undefined,
        });
      }
      return Promise.resolve(
        new Response(JSON.stringify(hit.body), {
          status: hit.status ?? 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }),
  );
}
