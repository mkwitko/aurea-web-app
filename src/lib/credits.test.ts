import { allowanceRemaining, availableCredits } from './credits';

describe('credit balance', () => {
  it('adds what is left of the allowance to the purchased balance', () => {
    expect(availableCredits({ allowance: 1_000, consumed: 400, purchasedBalance: 850 })).toBe(1_450);
  });

  it('never turns overspend into a negative balance', () => {
    // An upgrade mid-period grants the difference instead of rewriting the
    // frozen allowance, so consumed can exceed allowance legitimately.
    expect(availableCredits({ allowance: 200, consumed: 260, purchasedBalance: 100 })).toBe(100);
    expect(allowanceRemaining({ allowance: 200, consumed: 260 })).toBe(0);
  });

  it('reports a zero allowance on trial', () => {
    expect(availableCredits({ allowance: 0, consumed: 0, purchasedBalance: 50 })).toBe(50);
  });
});
