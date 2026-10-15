// Per-module constants for cache invalidation. Matches the Kubb queryKey prefix.
// The ledger has its own root: a grant changes the statement without changing
// the balance query's key, so both have to be invalidated by name.
export const CREDITS = {
  ENDPOINT: '/credits',
  queryKeyRoot: [{ url: '/credits' }] as const,
  LEDGER_ENDPOINT: '/credits/ledger',
  ledgerQueryKeyRoot: [{ url: '/credits/ledger' }] as const,
} as const;
