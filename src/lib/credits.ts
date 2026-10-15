/** What is left of this period's allowance. Never negative. */
export function allowanceRemaining({ allowance, consumed }: { allowance: number; consumed: number }): number {
  return Math.max(allowance - consumed, 0);
}

/**
 * What the workspace can actually spend: the rest of the monthly allowance
 * plus the purchased balance, which no subscription status takes away.
 */
export function availableCredits({
  allowance,
  consumed,
  purchasedBalance,
}: {
  allowance: number;
  consumed: number;
  purchasedBalance: number;
}): number {
  return allowanceRemaining({ allowance, consumed }) + purchasedBalance;
}
