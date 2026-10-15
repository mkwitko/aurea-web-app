import { parseProposal, parseRunGoalId } from './strategy-proposal';

function option(name = 'Founder-led outbound') {
  return {
    name,
    strategicThesis: 'Ops leads answer a person, not a campaign.',
    growthMechanism: 'Outbound',
    expectedOutcome: 'Ten discovery calls in three weeks',
    channels: ['Email'],
    assumptions: ['Ops leads read email'],
    risks: ['Deliverability'],
    tradeoffs: 'Slower than paid, cheaper to learn from.',
    hypotheses: [
      { statement: 'Plain text outperforms templates', rationale: 'r', targetMetric: 'reply_rate', expectedOutcome: 'e', confidence: 'MEDIUM' },
      { statement: 'Three touches beat one', rationale: 'r', targetMetric: 'reply_rate', expectedOutcome: 'e', confidence: 'LOW' },
    ],
  };
}

const proposal = { options: [option(), option('Content-led')], recommendedIndex: 0, rationale: 'Cheapest way to learn.' };

describe('parseProposal', () => {
  it('reads a well-formed proposal off the run output', () => {
    // The contract types output as unknown, so the page cannot render it
    // without parsing — and a cast would only move the crash later.
    const result = parseProposal(proposal);

    expect(result.ok).toBe(true);
    expect(result.ok && result.value.options).toHaveLength(2);
  });

  it('refuses a malformed output instead of rendering half of it', () => {
    expect(parseProposal({ options: 'nope' }).ok).toBe(false);
    expect(parseProposal(null).ok).toBe(false);
    expect(parseProposal({ ...proposal, recommendedIndex: 9 }).ok).toBe(false);
  });
});

describe('parseRunGoalId', () => {
  it('reads the goal id off a well-formed run input', () => {
    // Mirrors propose-strategies' inputSchema `{ goalId: uuid }` on the back
    // end — the only source the UI has for which goal a run reasoned about.
    expect(parseRunGoalId({ goalId: 'goal-1' })).toBe('goal-1');
  });

  it('says nothing instead of guessing at a malformed or missing input', () => {
    // `AgentRun.input` is unknown on the wire: a run of a different shape, a
    // still-null input (PENDING/RUNNING), or a stray string must never crash
    // or surface a raw, unverified value as if it were a goal id.
    expect(parseRunGoalId({ businessId: 'biz-1' })).toBeNull();
    expect(parseRunGoalId(null)).toBeNull();
    expect(parseRunGoalId(undefined)).toBeNull();
    expect(parseRunGoalId('goal-1')).toBeNull();
  });
});
