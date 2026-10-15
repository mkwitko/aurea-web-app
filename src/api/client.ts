import { refreshTokens, tokenStore, workspaceStore } from '@/lib/api';
import { API_BASE as BASE } from '@/lib/api-base';

export type RequestConfig<TData = unknown> = {
  method?: 'GET' | 'PUT' | 'PATCH' | 'POST' | 'DELETE' | 'OPTIONS' | 'HEAD';
  url?: string;
  baseURL?: string;
  params?: Record<string, unknown>;
  data?: TData;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type ResponseConfig<TData = unknown> = {
  data: TData;
  status: number;
  statusText: string;
  headers: Headers;
};

export type ResponseErrorConfig<TError = unknown> = {
  data: TError;
  status: number;
  statusText: string;
};

/** Client function type consumed by the Kubb-generated hooks. */
export type Client = <TData, _TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
) => Promise<ResponseConfig<TData>>;

export class ApiError<TError = unknown> extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly data: TError,
  ) {
    super(`API ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    // Kubb types `format: date-time` query params as `Date`, and the OpenAPI
    // contract documents the wire format as ISO 8601 — but `String(date)`
    // produces `Date.prototype.toString()` (e.g. "Mon Jul 28 2026 12:00:00
    // GMT+0000 ..."), not an ISO string. That happened to still work against
    // this backend today because its param schemas use `z.coerce.date()`
    // (see e.g. `back/src/http/api/credits/credits.schema.ts`), which is
    // lenient enough to parse it — so this was latent, not something that
    // was ever observed failing. Send the documented ISO format regardless,
    // rather than depend on that leniency.
    sp.set(k, v instanceof Date ? v.toISOString() : String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// Default export consumed by the Kubb-generated hooks (client.importPath).
async function client<TData, _TError = unknown, TVariables = unknown>(
  config: RequestConfig<TVariables>,
): Promise<ResponseConfig<TData>> {
  const baseURL = config.baseURL ?? BASE;
  const url = `${baseURL}${config.url ?? ''}${buildQuery(config.params)}`;
  const body = config.data !== undefined ? JSON.stringify(config.data) : undefined;

  // Whether the attempt below went out with credentials at all. Only such a
  // request can prove the session is dead: see the 401 handling further down.
  let sentWithToken = false;

  // Reads the token per attempt so the retry below picks up the refreshed one.
  const send = () => {
    const headers = new Headers(config.headers);
    // Only declare a JSON body when there actually is one — Fastify rejects
    // requests with `content-type: application/json` and an empty body.
    if (config.data !== undefined) headers.set('Content-Type', 'application/json');
    const token = tokenStore.access;
    sentWithToken = token !== null;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    // Absent until the user has picked a workspace at least once — the
    // backend's own fallback (oldest membership) covers that case, so no
    // header is sent rather than sending an empty one.
    const workspaceId = workspaceStore.id;
    if (workspaceId) headers.set('x-workspace-id', workspaceId);

    return fetch(url, { method: config.method ?? 'GET', headers, body, signal: config.signal });
  };

  let res = await send();

  // Access tokens live 15 minutes — less than it takes to fill a long form.
  // Refresh once and retry before declaring the session dead, otherwise a save
  // that lands a moment after expiry throws the user back to /login and their
  // input with it.
  if (res.status === 401 && (await refreshTokens())) res = await send();

  const payload = res.status === 204 ? undefined : await res.json().catch(() => undefined);

  // Only for a request that actually carried a token: a 401 on an
  // unauthenticated call (a rejected login, a register with a taken email) is
  // the endpoint's own answer, not an expired session. Ending the session there
  // would clear tokens that may belong to a perfectly good session and reload
  // the page out from under the form, so the user never reads why it failed.
  if (res.status === 401 && sentWithToken) {
    tokenStore.clear();
    if (typeof window !== 'undefined') window.location.assign('/login');
  }

  if (!res.ok) throw new ApiError(res.status, res.statusText, payload);

  return { data: payload as TData, status: res.status, statusText: res.statusText, headers: res.headers };
}

export default client;
