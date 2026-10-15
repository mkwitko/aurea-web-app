import { createContext, useContext, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMe, meQueryKey } from '@/api/generated/hooks/authHooks/useMe';
// The generated request functions, not the generated hooks: signing in is
// imperative and owns no cache entry of its own — `afterAuthentication` below
// is what updates the session query — so a `useMutation` would only add
// pending/error state that nobody here reads.
import { login as requestLogin } from '@/api/generated/hooks/authHooks/useLogin';
import { register as requestRegister } from '@/api/generated/hooks/authHooks/useRegister';
import { logout as requestLogout } from '@/api/generated/hooks/authHooks/useLogout';
import type { MeQueryResponse } from '@/api/generated/types/Me';
import { tokenStore } from './api';
import type { Role } from './roles';

/** The session user, straight off the contract. */
export type User = MeQueryResponse['user'];

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: User | null;
  role: Role | null;
  hasWorkspace: boolean;
  status: Status;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { name: string; email: string; password: string; organizationName: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface SessionMembership {
  workspaceId: string | null;
  role: Role;
}

/**
 * The role that governs what this user may do here. A workspace membership
 * wins over the organization-level one: the backend resolves the tenant to a
 * workspace, so that is the role it will enforce.
 */
function currentRole(memberships: readonly SessionMembership[]): Role | null {
  return (memberships.find((m) => m.workspaceId !== null) ?? memberships[0])?.role ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(tokenStore.access));

  // The session is a domain read, so it goes through the Kubb-generated
  // `useMe` hook like every other domain read — no hand-written client call.
  // Gated on there being a token at all: with none, no request is made.
  const meQuery = useMe({ query: { enabled: hasToken, retry: 1 } });

  const status: Status = !hasToken
    ? 'anonymous'
    : meQuery.isError
      ? 'anonymous'
      : meQuery.isSuccess
        ? 'authenticated'
        : 'loading';

  // Gated on isSuccess, not just on data being present: a query sitting in
  // an error state can still hold the last-successful data in the cache, and
  // that must never be exposed alongside a non-authenticated status.
  const user: User | null = meQuery.isSuccess ? meQuery.data.user : null;
  const role: Role | null = meQuery.isSuccess ? currentRole(meQuery.data.memberships) : null;

  // O que separa "conta criada" de "conta pronta para usar". A membership de
  // organização que o registro cria não tem workspace: enquanto for só ela, não
  // há o que renderizar no app — nenhuma rota de domínio responde sem workspace
  // (o backend devolve 403).
  const hasWorkspace: boolean = meQuery.isSuccess
    ? meQuery.data.memberships.some((m) => m.workspaceId !== null)
    : false;

  // On query error we deliberately do NOT clear the tokens here: a 401 is
  // already handled by `src/api/client.ts`, which clears them and redirects
  // to /login. Anything else (network blip, 500) leaves the tokens in place
  // so a reload can recover, instead of logging the user out over a
  // transient failure that has nothing to do with the session being invalid.

  /**
   * Stores the pair a sign-in returned and puts the session query back into a
   * clean pending state. The tokens are set here rather than inside the
   * generated call because the token lifecycle is this app's concern, not the
   * contract's.
   */
  async function afterAuthentication(
    authenticate: () => Promise<{ tokens: { accessToken: string; refreshToken: string } }>,
  ): Promise<void> {
    const { tokens } = await authenticate();
    tokenStore.set(tokens.accessToken, tokens.refreshToken);
    // Reset, not invalidate: if a token was already held (re-login without
    // logging out first) `hasToken` is already true, so `setHasToken(true)`
    // below is a no-op and the query for this same key may already be
    // sitting in an error state from the previous session (the deliberate
    // no-clear-on-error case). Invalidating only marks that entry stale — it
    // would keep reporting the old error (status 'anonymous') until the
    // background refetch lands. Resetting drops the error and any cached
    // data and puts the query straight back into its pending state, so the
    // mapping above reports 'loading' immediately and no stale user/role
    // from the previous session can ever be observed.
    // Fire-and-forget: login()/register() must not await the session read.
    void queryClient.resetQueries({ queryKey: meQueryKey() });
    setHasToken(true);
  }

  const login = (email: string, password: string) => afterAuthentication(() => requestLogin({ email, password }));

  const register = (input: { name: string; email: string; password: string; organizationName: string }) =>
    afterAuthentication(() => requestRegister(input));

  const logout = async () => {
    const refreshToken = tokenStore.refresh;
    // Revoking the refresh token server-side is best-effort. The user asked to
    // be signed out, so a failed (or unsent, with nothing to revoke) call must
    // not leave the tokens sitting in localStorage keeping them signed in.
    if (refreshToken) await requestLogout({ refreshToken }).catch(() => undefined);
    tokenStore.clear();
    // Removed outright (not just invalidated) so the next login on this tab
    // can never read the previous user's cached membership.
    queryClient.removeQueries({ queryKey: meQueryKey() });
    setHasToken(false);
  };

  return (
    <AuthContext.Provider value={{ user, role, hasWorkspace, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
