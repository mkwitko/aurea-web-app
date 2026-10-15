// Per-module constants for cache invalidation. Matches the Kubb queryKey prefix.
//
// O dashboard conta business, ICPs, objetivos, runs e estratégias, então ele
// fica obsoleto sempre que qualquer um deles muda — e o valor errado ali é o
// que faz a home dizer que uma etapa está feita depois de o fundador desfazê-la.
export const DASHBOARD = {
  ENDPOINT: '/dashboard',
  queryKeyRoot: [{ url: '/dashboard' }] as const,
} as const;
