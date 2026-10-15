import type { ExperimentStatusEnum2Key } from '@/api/generated/types/GetExperiment';
import { allowedExperimentActions } from './experiment-actions';

/**
 * The backend's table, transcribed from
 * `back/src/http/api/experiments/experiments.domain.ts`. Asserted whole rather
 * than case by case: a missing edge is what silently hides an action the user
 * is entitled to, and a spurious one offers a move the server will reject.
 */
const BACKEND_TRANSITIONS: Record<ExperimentStatusEnum2Key, ExperimentStatusEnum2Key[]> = {
  DRAFT: ['PLANNED', 'CANCELLED'],
  PLANNED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['RUNNING', 'CANCELLED'],
  RUNNING: ['PAUSED', 'COMPLETED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

describe('allowedExperimentActions', () => {
  it('offers exactly the moves the backend accepts, for every status', () => {
    for (const [status, expected] of Object.entries(BACKEND_TRANSITIONS)) {
      const actions = allowedExperimentActions(status as ExperimentStatusEnum2Key);
      expect(actions.map((action) => action.to)).toEqual(expected);
    }
  });

  it('offers nothing once the experiment is finished', () => {
    // COMPLETED and CANCELLED have no outgoing edge, so an action bar there
    // would be a row of buttons that can only produce a 400.
    expect(allowedExperimentActions('COMPLETED')).toEqual([]);
    expect(allowedExperimentActions('CANCELLED')).toEqual([]);
  });

  it('names the route for each move so the caller cannot mismatch them', () => {
    // The endpoint is not derivable from the target status: PLANNED is reached
    // through /plan and RUNNING through /start or nothing at all when resuming
    // from PAUSED. Pairing them here is what keeps a page from calling the
    // wrong mutation for a button it just rendered.
    expect(allowedExperimentActions('DRAFT')).toEqual([
      { to: 'PLANNED', action: 'plan', destructive: false },
      { to: 'CANCELLED', action: 'cancel', destructive: true },
    ]);
    expect(allowedExperimentActions('RUNNING')).toEqual([
      { to: 'PAUSED', action: 'pause', destructive: false },
      { to: 'COMPLETED', action: 'complete', destructive: false },
      { to: 'CANCELLED', action: 'cancel', destructive: true },
    ]);
    // Resuming a paused experiment is the same /start route as launching an
    // approved one.
    expect(allowedExperimentActions('PAUSED')).toEqual([
      { to: 'RUNNING', action: 'start', destructive: false },
      { to: 'CANCELLED', action: 'cancel', destructive: true },
    ]);
  });
});
