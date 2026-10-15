import { canBuyCredits, canManageSubscription } from './roles';

describe('billing permissions', () => {
  it('lets only the OWNER change the subscription', () => {
    expect(canManageSubscription('OWNER')).toBe(true);
    expect(canManageSubscription('ADMIN')).toBe(false);
    expect(canManageSubscription('MEMBER')).toBe(false);
    expect(canManageSubscription('VIEWER')).toBe(false);
  });

  it('lets OWNER and ADMIN buy credits', () => {
    expect(canBuyCredits('OWNER')).toBe(true);
    expect(canBuyCredits('ADMIN')).toBe(true);
    expect(canBuyCredits('MEMBER')).toBe(false);
    expect(canBuyCredits('VIEWER')).toBe(false);
  });

  it('denies everything when the role is unknown', () => {
    expect(canManageSubscription(null)).toBe(false);
    expect(canBuyCredits(null)).toBe(false);
  });
});
