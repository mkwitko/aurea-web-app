import type { HypothesisStatusEnum2Key } from '@/api/generated/types/GetHypothesis';

/** The route that performs a move, not the status it lands on. */
export type HypothesisAction = 'propose' | 'tested' | 'validate' | 'reject';

export interface HypothesisMove {
  to: HypothesisStatusEnum2Key;
  /** Which endpoint performs it — `POST /hypotheses/:id/<action>`. */
  action: HypothesisAction;
  /** Terminal and irreversible: the transition table has no edge out of it. */
  destructive: boolean;
}

const REJECT: HypothesisMove = { to: 'REJECTED', action: 'reject', destructive: true };

/**
 * Mirrors the transition table in
 * `back/src/http/api/hypotheses/hypotheses.domain.ts`. As with the experiment
 * mirror, the server re-checks every move — this only keeps dead buttons off
 * the screen.
 */
const MOVES: Record<HypothesisStatusEnum2Key, HypothesisMove[]> = {
  DRAFT: [{ to: 'PROPOSED', action: 'propose', destructive: false }, REJECT],
  PROPOSED: [{ to: 'TESTED', action: 'tested', destructive: false }, REJECT],
  TESTED: [{ to: 'VALIDATED', action: 'validate', destructive: false }, REJECT],
  VALIDATED: [],
  REJECTED: [],
};

export function allowedHypothesisActions(status: HypothesisStatusEnum2Key): HypothesisMove[] {
  return MOVES[status];
}

/**
 * Whether it is still worth designing an experiment for this hypothesis.
 *
 * An experiment exists to test a hypothesis, so once one is VALIDATED or
 * REJECTED there is nothing left to learn from running it. Not a backend rule —
 * `POST /experiments` accepts any hypothesis id — so this shapes what the create
 * page offers, and nothing more.
 */
export function canCarryExperiment(status: HypothesisStatusEnum2Key): boolean {
  return status === 'DRAFT' || status === 'PROPOSED' || status === 'TESTED';
}
