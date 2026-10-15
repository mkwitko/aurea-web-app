// Learnings are filtered server-side by experiment and status, so the cached
// key carries those params. The root matches every filter combination, which is
// the right blast radius: a validated learning changes what an unfiltered list
// and a status-filtered list both show.
export const LEARNINGS = {
  ENDPOINT: '/learnings',
  queryKeyRoot: [{ url: '/learnings' }] as const,
} as const;
