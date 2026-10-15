// Per-module constants for cache invalidation. Matches the Kubb queryKey prefix.
export const BILLING = {
  ENDPOINT: '/billing',
  queryKeyRoot: [{ url: '/billing' }] as const,
  PLANS_ENDPOINT: '/billing/plans',
  plansQueryKeyRoot: [{ url: '/billing/plans' }] as const,
} as const;
