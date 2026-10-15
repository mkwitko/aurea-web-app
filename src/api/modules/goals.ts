// Per-module constants for cache invalidation. Matches the Kubb queryKey prefix.
export const GOALS = {
  ENDPOINT: '/goals',
  queryKeyRoot: [{ url: '/goals' }] as const,
} as const;
