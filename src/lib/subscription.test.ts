import { isSubscriptionLive } from './subscription';

describe('isSubscriptionLive', () => {
  it('is live while Stripe is still charging the subscription', () => {
    expect(isSubscriptionLive('ACTIVE')).toBe(true);
    // A failed payment is still a live subscription: Stripe keeps retrying the
    // card, so the plan can be changed in place instead of re-subscribed.
    expect(isSubscriptionLive('PAST_DUE')).toBe(true);
  });

  it('is not live on trial or after cancellation', () => {
    expect(isSubscriptionLive('TRIAL')).toBe(false);
    // CANCELED keeps stripeSubscriptionId on the organization, so
    // hasSubscription stays true — the status is what decides.
    expect(isSubscriptionLive('CANCELED')).toBe(false);
  });
});
