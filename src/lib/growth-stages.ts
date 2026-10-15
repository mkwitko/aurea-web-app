import type { GetDashboard200 } from '@/api/generated/types/GetDashboard';

/** The five stages GrowthPage merges into one screen. */
export type GrowthStageKey = 'goals' | 'research' | 'strategies' | 'experiments' | 'learnings';

export const GROWTH_STAGES: readonly GrowthStageKey[] = ['goals', 'research', 'strategies', 'experiments', 'learnings'];

export type StageStatus = 'DONE' | 'CURRENT' | 'TODO';

/** Narrows an unvalidated `:stage` route param to a real `GrowthStageKey`. */
export function isGrowthStage(value: string | undefined): value is GrowthStageKey {
  return value != null && (GROWTH_STAGES as readonly string[]).includes(value);
}

type SetupFlags = Pick<GetDashboard200['setup'], 'goal' | 'research' | 'strategy' | 'experiment'>;

/**
 * DONE/CURRENT/TODO for the five growth stages, derived from the dashboard's
 * own `setup` flags — never re-decided here.
 *
 * `learnings` has no boolean of its own (there is no `setup.learnings`): the
 * loop feeds back into `goals` for the next iteration rather than ever
 * "completing", so it never reports DONE. `experiments` additionally waits on
 * `pendingMeasurementCount`: an experiment whose outcome nobody has recorded
 * yet is not a closed stage, whatever `setup.experiment` says.
 *
 * The first stage that is not DONE is CURRENT; everything before it is DONE,
 * everything after is TODO. Because `learnings` is never DONE, this always
 * resolves to *some* CURRENT stage — a fresh workspace lands on `goals`, one
 * that has finished everything else lands on `learnings` — which is exactly
 * "first stage with a pendência, or goals" from the spec.
 */
export function deriveGrowthStageStates(
  setup: SetupFlags | undefined,
  pendingMeasurementCount: number,
): Record<GrowthStageKey, StageStatus> {
  const done: Record<GrowthStageKey, boolean> = {
    goals: !!setup?.goal,
    research: !!setup?.research,
    strategies: !!setup?.strategy,
    experiments: !!setup?.experiment && pendingMeasurementCount === 0,
    learnings: false,
  };

  const currentIndex = GROWTH_STAGES.findIndex((stage) => !done[stage]);

  return Object.fromEntries(
    GROWTH_STAGES.map((stage, i) => [stage, i < currentIndex ? 'DONE' : i === currentIndex ? 'CURRENT' : 'TODO']),
  ) as Record<GrowthStageKey, StageStatus>;
}

/** The stage GrowthPage opens on when the URL carries none. */
export function defaultGrowthStage(setup: SetupFlags | undefined, pendingMeasurementCount: number): GrowthStageKey {
  const states = deriveGrowthStageStates(setup, pendingMeasurementCount);
  return GROWTH_STAGES.find((stage) => states[stage] === 'CURRENT') ?? 'goals';
}
