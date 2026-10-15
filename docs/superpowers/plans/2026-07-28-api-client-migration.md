# Retire the hand-written API client

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Status: complete (2026-07-28).** Executed on `web` `refactor/api-client-migration`, commits `1e921d1..8828f59` — 167 tests / 32 files pass, typecheck clean, build clean. One step is still open (the manual check against a live backend, Task 3) and there are two deviations, both recorded in the task notes below: Task 3's "successful login stores both tokens" test passed before the migration (kept as a guard for the transport swap, not claimed as TDD), and Task 6 replaced the origin test instead of keeping it, because a single shared constant makes value assertions unfalsifiable.

**Goal:** `src/lib/api.ts` ends up holding nothing but the token lifecycle — `tokenStore` and the single-flight `refreshTokens` — with every request in the app going through the Kubb-generated client. This closes the follow-up recorded during Task 4 of the billing frontend ("the remaining hand-written domain calls are the same anti-pattern the `useMe` ruling removed").

**Architecture:** Kubb generates, per operation, both a hook (`useLogin`) and a plain async request function (`login(data)`). The auth flow is imperative and owns no cache entry — `AuthProvider` already sequences it through `afterAuthentication` and resets the `useMe` query itself — so it consumes the *request functions*; `BusinessPage`'s delete consumes the *hook*, whose `isPending` replaces the local `deleting` flag. `refreshTokens` keeps its own bare `fetch`: it cannot go through the generated client without recursing into that client's own 401-refresh path.

**Tech Stack:** Vite 6, React 19, TypeScript strict ESM, Kubb 4 + TanStack Query 5, Tailwind v4 + shadcn/ui, react-i18next (en/pt/es), Vitest + Testing Library.

## Survey (facts this plan is built on, read on 2026-07-28)

Live consumers of `src/lib/api.ts`:

| Consumer | What it uses | Fate |
|---|---|---|
| `src/api/client.ts:1` | `tokenStore`, `refreshTokens` | stays — this is the token lifecycle |
| `src/lib/auth.tsx:4` | `api.login`, `api.register`, `api.logout`, `type User` | Tasks 3, 4, 6 |
| `src/pages/BusinessPage.tsx:45` | `api.deleteBusiness()` | Task 5 |
| `src/pages/LoginPage.tsx:35`, `src/pages/RegisterPage.tsx:46` | `ApiError` (to show the backend's message) | Tasks 2, 3 |

Everything else in the file is already dead: `Business`/`Icp`/`Goal`/`Strategy`/`Priority`/`GoalStatus`/`StrategyStatus`, plus all 19 domain methods. No importer anywhere in `src/`.

## Global Constraints

- **Domain data only through Kubb-generated code** (`src/api/generated/…`). No new hand-written fetch. The one exception is `refreshTokens`, which must not be routed through the generated client — see Task 6.
- **No `any`, no casual `as`.** Domain types come from `src/api/generated/types`.
- **Tailwind + shadcn only**; no plain CSS, no themed inline `style={{}}`.
- **Every user-facing string is an i18n key** present in all of `src/i18n/locales/{en,pt,es}.json`.
- **TDD, no exceptions.** Every task starts with a test that is watched failing, for the stated reason, before any production line is written.
- **Gate before declaring a task done:** `pnpm typecheck` and `pnpm test` clean; plus `pnpm build` on the last task.
- Two independent git repos — this plan touches `web/` only.

---

## Task 1 — A 401 on an unauthenticated request must not log the user out

`src/api/client.ts:94` clears the tokens and calls `window.location.assign('/login')` on **any** 401. A rejected login *is* a 401. Today nothing unauthenticated goes through this client, so the bug is latent; Task 3 makes it live, and the symptom would be a wrong password hard-reloading the page with no error message ever shown. Fix it first, on its own, so the auth migration can't be blamed for it.

The rule: only a request that carried an `Authorization` header can represent a dead session. A request sent without a token has no session to invalidate.

- [x] RED: `src/api/client.test.ts` — with no token in `tokenStore`, a 401 response must leave `window.location.assign` uncalled and must throw `ApiError` carrying the backend body; with a token, the existing clear-and-redirect must still happen (two tests, so neither direction can silently flip).
- [x] GREEN: track whether `send()` attached a token and gate the clear/redirect on it.
- [x] Confirm the refresh-and-retry path is unaffected: no token means `refreshTokens()` returns false already, so nothing new short-circuits.

## Task 2 — `apiErrorMessage`: the backend's message, not `"API 401 Unauthorized"`

The generated client throws `ApiError(status, statusText, data)`, whose `.message` is the synthetic `API 401 Unauthorized`. The auth pages currently render `err.message` from the *hand-written* `ApiError`, which is the backend's human message. Migrating without this step would put "API 401 Unauthorized" in front of the user, or collapse every failure to the generic `t('auth.error')`.

- [x] RED: `src/lib/api-errors.test.ts` — extracts `data.error.message` from a generated-client `ApiError`; falls back to the supplied fallback for a plain `Error`, for `null`, and for an `ApiError` whose body has no `error.message`; never returns the synthetic `API <status> <statusText>` string.
- [x] GREEN: `src/lib/api-errors.ts` exporting `apiErrorMessage(error: unknown, fallback: string): string`, shaped like the existing `src/lib/billing-errors.ts` (same defensive unknown-narrowing, no `as any`).
- [x] Note in the doc comment why `.message` is not usable, so nobody "simplifies" it back.

## Task 3 — `login` and `register` through the generated client

- [x] RED: extend `src/lib/auth.test.tsx` — (a) a successful login stores both tokens and lands on `status: 'authenticated'`; (b) a rejected login leaves the tokens untouched, keeps `status: 'anonymous'`, and surfaces the backend's message; (c) the existing re-login-over-a-stale-error test must stay green (it guards the `resetQueries` semantics).
- [x] GREEN: `auth.tsx` imports `login`/`register` from `@/api/generated/hooks/authHooks/…` (the request functions, not the hooks — `AuthProvider` needs neither pending state nor a mutation key) and calls `tokenStore.set(tokens.accessToken, tokens.refreshToken)` itself. `afterAuthentication` keeps its current shape and the `void queryClient.resetQueries({ queryKey: meQueryKey() })` + `setHasToken(true)` ordering, comments intact.
- [x] `LoginPage.tsx` / `RegisterPage.tsx`: replace `err instanceof ApiError ? err.message : t('auth.error')` with `apiErrorMessage(err, t('auth.error'))`. Delete the `ApiError` import from `../lib/api`.
- [ ] **NOT DONE — open.** Verify by hand against a running backend that a wrong password shows the backend message and does **not** navigate. Covered automatically by `src/pages/LoginPage.test.tsx` against a stubbed 401, but no run against a live API happened, so the real error envelope (`{ error: { code, message } }` from `back/src/shared/errors`) is asserted from the contract, not observed.

## Task 4 — `logout` through the generated client

Current behaviour to preserve exactly: the request is best-effort (`.catch(() => undefined)`), the tokens are cleared **whether or not it succeeds**, and `removeQueries({ queryKey: meQueryKey() })` runs so the next login on this tab cannot read the previous user's memberships.

- [x] RED: a logout whose request fails (500) still clears both tokens and still reports `status: 'anonymous'`. That is the case a naive `await logout()` breaks.
- [x] GREEN: call the generated `logout` request function with the stored refresh token inside a `try`/`finally` (or `.catch`), then `tokenStore.clear()`, `removeQueries`, `setHasToken(false)`.

## Task 5 — `BusinessPage` delete through `useDeleteBusiness`

- [x] RED: `src/pages/BusinessPage.test.tsx` (new) — confirming the destructive dialog issues `DELETE /business`, invalidates `BUSINESS.queryKeyRoot`, and navigates to `/app`; and a failed delete leaves the user on the page with the business still listed, instead of navigating away as if it had worked (the current `try`/`finally` navigates only on success, but nothing covers it, and nothing tells the user it failed).
- [x] GREEN: `useDeleteBusiness` with `onSuccess` doing the invalidation + navigation; drop the local `deleting` state in favour of `isPending`; add an error message via the existing i18n conventions (new key in all three locales if none fits).

## Task 6 — Strip `src/lib/api.ts` to the token lifecycle

- [x] Delete the 19 dead domain methods and the dead `Business`/`Icp`/`Goal`/`Strategy`/`Priority`/`GoalStatus`/`StrategyStatus` types.
- [x] Delete the hand-written `ApiError` class once Tasks 3–5 have removed its last consumer, so exactly one `ApiError` (the generated client's) exists in the codebase — two classes with the same name and different semantics is what made Task 2 necessary.
- [x] Replace `interface User` with the generated session type (`MeQueryResponse['user']`), re-exported from `auth.tsx` if convenient, and drop the `type User` import from `./api`.
- [x] Keep `tokenStore`, `refreshTokens`, `rotateTokens` and the minimal `raw`/`request` needed by the refresh call. Extend the existing doc comment to state plainly that this one request stays hand-written because routing it through the generated client would recurse into that client's 401-refresh path.
- [x] Gate: `pnpm typecheck`, `pnpm test`, `pnpm build` all clean. `grep -rn "from '@/lib/api'" src/` should return only `src/api/client.ts` and whatever still legitimately needs `tokenStore`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Login failure logs the user out and reloads the page | Task 1, before any auth migration, with tests in both directions |
| "API 401 Unauthorized" shown to the user | Task 2; Task 3 wires it into both auth pages |
| Circular import (`lib/api` ↔ `api/client`) | `refreshTokens` keeps its bare `fetch`; nothing in `lib/api.ts` imports generated code |
| Silent regression in the session lifecycle | The Task 4 re-login/stale-error tests already exist and must stay green; Tasks 3–4 add the token-side assertions they lack |
