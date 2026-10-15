/**
 * Origin every request goes to, for both `src/lib/api.ts` and the generated
 * client in `src/api/client.ts`.
 *
 * One constant on purpose: each client used to carry its own fallback, and they
 * drifted (`:3333` against the backend's `:3337`), so a checkout without a
 * `.env` sent auth to a port with nothing on it while the generated hooks were
 * fine — a broken login with no obvious cause.
 */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3337';
