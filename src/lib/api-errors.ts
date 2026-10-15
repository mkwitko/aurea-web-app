import type { ApiError } from '@/api/client';

/**
 * The message worth showing the user for a failed request.
 *
 * Deliberately not `error.message`: on the generated client's `ApiError` that
 * is built from the status line ("API 401 Unauthorized"), which explains
 * nothing to a founder. The readable text is the backend's own, inside the
 * parsed body — and the body is untrusted input, so every step is checked and
 * anything else lands on `fallback` (an i18n string supplied by the caller).
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as Partial<ApiError<{ error?: { message?: unknown } }>> | null | undefined)?.data;
  const message = data?.error?.message;
  return typeof message === 'string' && message.length > 0 ? message : fallback;
}
