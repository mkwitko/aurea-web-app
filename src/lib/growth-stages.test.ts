import { describe, expect, it } from 'vitest';
import { defaultGrowthStage, deriveGrowthStageStates, GROWTH_STAGES, isGrowthStage } from './growth-stages';

describe('isGrowthStage', () => {
  it('accepts every real stage key', () => {
    for (const stage of GROWTH_STAGES) {
      expect(isGrowthStage(stage)).toBe(true);
    }
  });

  it('rejects anything else, including undefined', () => {
    expect(isGrowthStage('icps')).toBe(false);
    expect(isGrowthStage('business')).toBe(false);
    expect(isGrowthStage(undefined)).toBe(false);
  });
});

describe('deriveGrowthStageStates', () => {
  it('a brand-new workspace has goals CURRENT and everything after it TODO', () => {
    const states = deriveGrowthStageStates(undefined, 0);
    expect(states).toEqual({
      goals: 'CURRENT',
      research: 'TODO',
      strategies: 'TODO',
      experiments: 'TODO',
      learnings: 'TODO',
    });
  });

  it('marks each finished stage DONE and stops at the first unfinished one', () => {
    const states = deriveGrowthStageStates({ goal: true, research: true, strategy: false, experiment: false }, 0);
    expect(states.goals).toBe('DONE');
    expect(states.research).toBe('DONE');
    expect(states.strategies).toBe('CURRENT');
    expect(states.experiments).toBe('TODO');
    expect(states.learnings).toBe('TODO');
  });

  it('does not count the experiment stage done while a measurement is pending', () => {
    // setup.experiment is true — an experiment exists — but nobody has
    // recorded its outcome yet, so the stage cannot be closed.
    const states = deriveGrowthStageStates({ goal: true, research: true, strategy: true, experiment: true }, 2);
    expect(states.experiments).toBe('CURRENT');
    expect(states.learnings).toBe('TODO');
  });

  it('learnings is never DONE — it is the loop stage that feeds the next one', () => {
    const states = deriveGrowthStageStates({ goal: true, research: true, strategy: true, experiment: true }, 0);
    expect(states.experiments).toBe('DONE');
    expect(states.learnings).toBe('CURRENT');
  });
});

describe('defaultGrowthStage', () => {
  it('opens on goals for a workspace with nothing set up', () => {
    expect(defaultGrowthStage(undefined, 0)).toBe('goals');
  });

  it('opens on the first stage with a pendência', () => {
    expect(defaultGrowthStage({ goal: true, research: false, strategy: false, experiment: false }, 0)).toBe(
      'research',
    );
  });

  it('opens on learnings once every other stage is settled', () => {
    expect(defaultGrowthStage({ goal: true, research: true, strategy: true, experiment: true }, 0)).toBe('learnings');
  });
});
