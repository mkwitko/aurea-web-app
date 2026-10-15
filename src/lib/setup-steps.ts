/**
 * The eight setup steps the dashboard checklist (`SetupChecklist`) shows.
 *
 * Mirrors the server's `SETUP` array in
 * `back/src/http/api/dashboard/dashboard.domain.ts` — same order, same keys.
 * The two repositories share no code, so this is a deliberate copy, and the
 * order is the part that must not drift, because `SetupChecklist` renders it
 * as a fixed, numbered list.
 *
 * This used to live in `onboarding-steps.ts` alongside the old 8-step guide's
 * own navigation helpers (`firstUndone`, `stepByKey`, `undoneBefore`). That
 * guide is gone (Phase 5 replaced it with the 3-step concierge in
 * `src/lib/concierge.ts`), but the dashboard's activation checklist is a
 * separate, still-standing feature that only ever needed this static list —
 * so the list moved here rather than disappearing with the rest.
 */
export type SetupStepKey =
  | 'business'
  | 'context'
  | 'icp'
  | 'goal'
  | 'research'
  | 'strategy'
  | 'hypothesis'
  | 'experiment';

export interface SetupStep {
  key: SetupStepKey;
  n: number;
  route: string;
}

export const SETUP_STEPS: readonly SetupStep[] = [
  { key: 'business', n: 1, route: '/app/business/setup' },
  { key: 'context', n: 2, route: '/app/business' },
  { key: 'icp', n: 3, route: '/app/icps/new' },
  { key: 'goal', n: 4, route: '/app/goals/new' },
  { key: 'research', n: 5, route: '/app/research' },
  { key: 'strategy', n: 6, route: '/app/strategies' },
  { key: 'hypothesis', n: 7, route: '/app/strategies' },
  { key: 'experiment', n: 8, route: '/app/experiments/new' },
];
