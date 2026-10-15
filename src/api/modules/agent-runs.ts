// The list and the detail have different roots: starting a run changes the
// list of runs in flight without touching any individual run's key.
export const AGENT_RUNS = {
  ENDPOINT: '/agent-runs',
  queryKeyRoot: [{ url: '/agent-runs' }] as const,
  detailQueryKeyRoot: [{ url: '/agent-runs/:id' }] as const,
} as const;
