import { describe, expect, it } from 'vitest';
import { SETUP_STEPS } from './setup-steps';

describe('SETUP_STEPS', () => {
  it('has eight steps, numbered from one, in funnel order', () => {
    expect(SETUP_STEPS).toHaveLength(8);
    expect(SETUP_STEPS.map((s) => s.key)).toEqual([
      'business', 'context', 'icp', 'goal', 'research', 'strategy', 'hypothesis', 'experiment',
    ]);
    expect(SETUP_STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('frames a real route for every step', () => {
    for (const step of SETUP_STEPS) expect(step.route.startsWith('/app/')).toBe(true);
  });
});
