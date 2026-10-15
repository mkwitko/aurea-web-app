import type { LearningsStatusEnumKey } from '@/api/generated/types/ListLearnings';
import { allowedLearningActions } from './learning-actions';

/**
 * The backend's table, transcribed from
 * `back/src/http/api/learnings/learnings.domain.ts`. Asserted whole for the same
 * reason as the experiment one: a missing edge hides a decision the user is
 * entitled to make, and a spurious one offers a move the server will refuse.
 */
const BACKEND_TRANSITIONS: Record<LearningsStatusEnumKey, LearningsStatusEnumKey[]> = {
  CANDIDATE: ['VALIDATED', 'REJECTED'],
  VALIDATED: ['ARCHIVED'],
  REJECTED: ['ARCHIVED'],
  ARCHIVED: [],
};

describe('allowedLearningActions', () => {
  it('offers exactly the moves the backend accepts, for every status', () => {
    for (const [status, expected] of Object.entries(BACKEND_TRANSITIONS)) {
      const actions = allowedLearningActions(status as LearningsStatusEnumKey);
      expect(actions.map((action) => action.to)).toEqual(expected);
    }
  });

  it('offers nothing once the learning is archived', () => {
    // ARCHIVED has no outgoing edge. Buttons there could only produce a 400.
    expect(allowedLearningActions('ARCHIVED')).toEqual([]);
  });

  it('names the route for each move so the caller cannot mismatch them', () => {
    expect(allowedLearningActions('CANDIDATE')).toEqual([
      { to: 'VALIDATED', action: 'validate', destructive: false },
      { to: 'REJECTED', action: 'reject', destructive: true },
    ]);
    expect(allowedLearningActions('VALIDATED')).toEqual([
      { to: 'ARCHIVED', action: 'archive', destructive: true },
    ]);
    expect(allowedLearningActions('REJECTED')).toEqual([
      { to: 'ARCHIVED', action: 'archive', destructive: true },
    ]);
  });

  it('marks rejecting and archiving as decisions that do not come back', () => {
    // Neither has an edge returning to CANDIDATE: a rejected learning cannot be
    // reproposed and an archived one cannot be reopened. The flag is what makes
    // the action bar confirm first — see Task 7 of the plan.
    const irreversible = [
      ...allowedLearningActions('CANDIDATE'),
      ...allowedLearningActions('VALIDATED'),
    ].filter((move) => move.destructive);

    expect(irreversible.map((move) => move.action)).toEqual(['reject', 'archive']);
  });
});
