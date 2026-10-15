import { describe, expect, it } from 'vitest';
import { interpretOutcomeOutput } from './interpret-outcome';

const VALID = {
  reading: 'Replies reached 18 against a baseline of 4.',
  drivers: ['The list was filtered to recently funded founders.'],
  caveats: [],
  learning: {
    title: 'Funding-round personalization lifts reply rate',
    statement: 'Referencing a recent raise lifted replies above baseline.',
    evidence: ['18 replies on 2026-07-30'],
    confidence: 'MEDIUM',
  },
};

describe('interpretOutcomeOutput', () => {
  it('parses a well-formed run output', () => {
    expect(interpretOutcomeOutput.safeParse(VALID).success).toBe(true);
  });

  it('rejects output missing the draft learning', () => {
    // AgentRun.output is Json — a refused or half-written run can hold
    // anything, and the panel must not render a partial draft.
    const { learning: _learning, ...rest } = VALID;
    expect(interpretOutcomeOutput.safeParse(rest).success).toBe(false);
  });

  it('rejects a verdict smuggled into the output', () => {
    expect(interpretOutcomeOutput.safeParse({ ...VALID, verdict: 'MET' }).success).toBe(false);
  });
});
