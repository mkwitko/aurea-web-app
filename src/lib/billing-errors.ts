import type { ApiError } from '@/api/client';

/**
 * `AUR-T0016 BILLING_NOT_CONFIGURED` — an operator problem, not a user error.
 * Shared by every screen that can hit a billing mutation, so the "this
 * environment has no Stripe wired up" message stays worded once.
 */
export function isNotConfigured(error: unknown): boolean {
  const data = (error as Partial<ApiError<{ error?: { code?: string } }>> | null | undefined)?.data;
  return data?.error?.code === 'AUR-T0016';
}
