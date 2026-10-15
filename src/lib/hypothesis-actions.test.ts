import type { HypothesisStatusEnum2Key } from '@/api/generated/types/GetHypothesis';
import { allowedHypothesisActions, canCarryExperiment } from './hypothesis-actions';

/** Transcribed from `back/src/http/api/hypotheses/hypotheses.domain.ts`. */
const BACKEND_TRANSITIONS: Record<HypothesisStatusEnum2Key, HypothesisStatusEnum2Key[]> = {
  DRAFT: ['PROPOSED', 'REJECTED'],
  PROPOSED: ['TESTED', 'REJECTED'],
  TESTED: ['VALIDATED', 'REJECTED'],
  VALIDATED: [],
  REJECTED: [],
};

describe('allowedHypothesisActions', () => {
  it('offers exactly the moves the backend accepts, for every status', () => {
    for (const [status, expected] of Object.entries(BACKEND_TRANSITIONS)) {
      const actions = allowedHypothesisActions(status as HypothesisStatusEnum2Key);
      expect(actions.map((action) => action.to)).toEqual(expected);
    }
  });

  it('offers nothing once the hypothesis is settled', () => {
    expect(allowedHypothesisActions('VALIDATED')).toEqual([]);
    expect(allowedHypothesisActions('REJECTED')).toEqual([]);
  });

  it('names the route for each move', () => {
    // "TESTED" is reached through /tested, whose generated hook is called
    // useMarkHypothesisTested — the one place the name does not follow the
    // status.
    expect(allowedHypothesisActions('PROPOSED')).toEqual([
      { to: 'TESTED', action: 'tested', destructive: false },
      { to: 'REJECTED', action: 'reject', destructive: true },
    ]);
  });
});

describe('canCarryExperiment', () => {
  it('is true for a hypothesis that is still in play', () => {
    // An experiment tests a hypothesis, so proposing one for a hypothesis
    // already settled either way is work with nothing to learn from it. DRAFT
    // is included: the backend accepts it, and a founder drafting both
    // together is the normal flow.
    expect(canCarryExperiment('DRAFT')).toBe(true);
    expect(canCarryExperiment('PROPOSED')).toBe(true);
    expect(canCarryExperiment('TESTED')).toBe(true);
  });

  it('is false once the hypothesis is validated or rejected', () => {
    expect(canCarryExperiment('VALIDATED')).toBe(false);
    expect(canCarryExperiment('REJECTED')).toBe(false);
  });
});
