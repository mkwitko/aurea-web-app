import type { LearningsStatusEnumKey } from '@/api/generated/types/ListLearnings';

/** The route that performs a move, not the status it lands on. */
export type LearningAction = 'validate' | 'reject' | 'archive';

export interface LearningMove {
  /** Status the learning ends up in. */
  to: LearningsStatusEnumKey;
  /** Which endpoint performs it — `POST /learnings/:id/<action>`. */
  action: LearningAction;
  /** Terminal in the direction it goes: the table has no edge back. */
  destructive: boolean;
}

const ARCHIVE: LearningMove = { to: 'ARCHIVED', action: 'archive', destructive: true };

/**
 * Mirrors the transition table in
 * `back/src/http/api/learnings/learnings.domain.ts`.
 *
 * Same contract as `experiment-actions`: the UI never offers a move the server
 * will refuse, and the server re-checks every move anyway
 * (`assertLearningTransition`), so this is about not rendering a dead button —
 * never about enforcement.
 *
 * Both decided states lead only to ARCHIVED and nothing leads back to
 * CANDIDATE. Validating is the one move that is not marked destructive: it is
 * the outcome the loop is trying to reach, and a validated learning can still
 * be archived afterwards.
 */
const MOVES: Record<LearningsStatusEnumKey, LearningMove[]> = {
  CANDIDATE: [
    { to: 'VALIDATED', action: 'validate', destructive: false },
    { to: 'REJECTED', action: 'reject', destructive: true },
  ],
  VALIDATED: [ARCHIVE],
  REJECTED: [ARCHIVE],
  ARCHIVED: [],
};

export function allowedLearningActions(status: LearningsStatusEnumKey): LearningMove[] {
  return MOVES[status];
}
