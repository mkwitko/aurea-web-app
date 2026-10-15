// The outcome list hangs off an experiment, so its Kubb key carries the
// experiment id as well as the url. Invalidating by the url alone is a partial
// match and clears every experiment's list — which is what a page wants after
// recording a measurement, since it does not know which other lists are cached.
export const OUTCOMES = {
  ENDPOINT: '/experiments/:id/outcomes',
  queryKeyRoot: [{ url: '/experiments/:id/outcomes' }] as const,
} as const;
