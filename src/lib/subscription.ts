import type { GetBilling200StatusEnumKey } from '@/api/generated/types/GetBilling';

/**
 * Whether the organization has a subscription Stripe is still charging, and so
 * a plan change is an update to that subscription rather than a new one.
 *
 * Mirrors the backend guard in `checkout.service.changePlan` exactly (ACTIVE or
 * PAST_DUE, anything else → 409 `AUR-T0019`). It deliberately reads the status
 * and not `hasSubscription`: cancelling only sets `subscriptionStatus` to
 * CANCELED and leaves `stripeSubscriptionId` in place, so `hasSubscription`
 * stays true for an organization that has to go through checkout again.
 */
export function isSubscriptionLive(status: GetBilling200StatusEnumKey): boolean {
  return status === 'ACTIVE' || status === 'PAST_DUE';
}
