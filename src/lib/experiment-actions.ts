import type { ExperimentStatusEnum2Key } from '@/api/generated/types/GetExperiment';

/** The route that performs a move, not the status it lands on. */
export type ExperimentAction = 'plan' | 'approve' | 'start' | 'pause' | 'complete' | 'cancel';

export interface ExperimentMove {
  /** Status the experiment ends up in. */
  to: ExperimentStatusEnum2Key;
  /** Which endpoint performs it — `POST /experiments/:id/<action>`. */
  action: ExperimentAction;
  /** Terminal and irreversible: the transition table has no edge out of it. */
  destructive: boolean;
}

const CANCEL: ExperimentMove = { to: 'CANCELLED', action: 'cancel', destructive: true };

/**
 * Mirrors the transition table in
 * `back/src/http/api/experiments/experiments.domain.ts`.
 *
 * The point is that the UI never offers a move the server will refuse — every
 * transition is still re-checked there (`assertExperimentTransition`), so this
 * is about not putting a dead button in front of the user, never about
 * enforcement. Order is the order the buttons appear in: the forward move
 * first, cancelling last.
 */
const MOVES: Record<ExperimentStatusEnum2Key, ExperimentMove[]> = {
  DRAFT: [{ to: 'PLANNED', action: 'plan', destructive: false }, CANCEL],
  PLANNED: [{ to: 'APPROVED', action: 'approve', destructive: false }, CANCEL],
  APPROVED: [{ to: 'RUNNING', action: 'start', destructive: false }, CANCEL],
  RUNNING: [
    { to: 'PAUSED', action: 'pause', destructive: false },
    { to: 'COMPLETED', action: 'complete', destructive: false },
    CANCEL,
  ],
  // Resuming is the same /start route that launches an approved experiment.
  PAUSED: [{ to: 'RUNNING', action: 'start', destructive: false }, CANCEL],
  COMPLETED: [],
  CANCELLED: [],
};

export function allowedExperimentActions(status: ExperimentStatusEnum2Key): ExperimentMove[] {
  return MOVES[status];
}
