// Access/refresh token lifecycle. Everything else — every domain request —
// goes through the Kubb-generated client in `src/api/client.ts`.
import { API_BASE } from './api-base';

const ACCESS_KEY = 'aurea.access';
const REFRESH_KEY = 'aurea.refresh';
const WORKSPACE_KEY = 'aurea.workspaceId';

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/**
 * The selected workspace, read synchronously by `src/api/client.ts` (to send
 * `x-workspace-id`) and `src/lib/run-events.ts` (to pick the SSE channel) —
 * neither can consume the React context in `src/lib/workspace.tsx`, which
 * wraps this same store for components. `null` means nothing has been picked
 * yet: no header is sent, and the backend falls back to the caller's oldest
 * membership on its own.
 */
export const workspaceStore = {
  get id(): string | null {
    return localStorage.getItem(WORKSPACE_KEY);
  },
  set(id: string) {
    localStorage.setItem(WORKSPACE_KEY, id);
  },
};

/**
 * The one request in the app that does not go through the generated client,
 * and cannot: `src/api/client.ts` answers a 401 by calling `refreshTokens()`
 * and retrying, so routing the refresh itself through it would recurse into
 * that same path. A bare `fetch` keeps the rotation outside the interceptor it
 * exists to serve.
 */
async function rotateTokens(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) return false;

  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  tokenStore.set(data.accessToken, data.refreshToken);
  return true;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the refresh token for a fresh pair. Single-flight on purpose: the
 * server rotates *and revokes* the refresh token, so two concurrent refreshes
 * would revoke each other and log the user out.
 */
export function refreshTokens(): Promise<boolean> {
  refreshInFlight ??= rotateTokens().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}
