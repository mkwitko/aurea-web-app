import { describe, expect, it } from 'vitest';
import {
  AI_FILLABLE_CONTEXT_SECTIONS,
  conciergeMacroStage,
  deriveConciergeStep,
  questionsDoneStorageKey,
  type ConciergeInput,
} from './concierge';

const BASE: ConciergeInput = {
  business: { id: 'biz-1' },
  runs: {
    'propose-business-profile': 'COMPLETED',
    'propose-business-context': 'COMPLETED',
    'propose-icp': 'COMPLETED',
    'propose-goal': 'COMPLETED',
    'research-growth-context': 'COMPLETED',
  },
  filledContextSections: AI_FILLABLE_CONTEXT_SECTIONS,
  icps: [{}],
  goals: [{ status: 'ACTIVE' }],
  questionsPending: false,
  questionsDone: true,
};

describe('deriveConciergeStep', () => {
  it('asks for the url when there is no business yet', () => {
    expect(deriveConciergeStep({ ...BASE, business: null })).toBe('ask-url');
  });

  it('runs the profile agent when the business exists but its run never completed', () => {
    expect(deriveConciergeStep({ ...BASE, runs: { ...BASE.runs, 'propose-business-profile': undefined } })).toBe(
      'running-profile',
    );
    expect(deriveConciergeStep({ ...BASE, runs: { ...BASE.runs, 'propose-business-profile': 'RUNNING' } })).toBe(
      'running-profile',
    );
    expect(deriveConciergeStep({ ...BASE, runs: { ...BASE.runs, 'propose-business-profile': 'FAILED' } })).toBe(
      'running-profile',
    );
  });

  it('runs the context agent once the profile is done but context is not applied', () => {
    expect(
      deriveConciergeStep({
        ...BASE,
        runs: { ...BASE.runs, 'propose-business-context': undefined },
        filledContextSections: 0,
      }),
    ).toBe('running-context');
  });

  it('skips a redundant context run when the sections are already filled without a run on record', () => {
    expect(
      deriveConciergeStep({
        ...BASE,
        runs: { ...BASE.runs, 'propose-business-context': undefined },
        filledContextSections: AI_FILLABLE_CONTEXT_SECTIONS,
      }),
    ).not.toBe('running-context');
  });

  it('shows the merged question screen once profile and context are both done and a question is open', () => {
    expect(deriveConciergeStep({ ...BASE, questionsPending: true, questionsDone: false })).toBe('questions');
  });

  it('does not show questions again once the founder has already been through them', () => {
    expect(deriveConciergeStep({ ...BASE, questionsPending: true, questionsDone: true })).not.toBe('questions');
  });

  it('does not show questions when none are open, even if not yet marked done', () => {
    expect(deriveConciergeStep({ ...BASE, questionsPending: false, questionsDone: false })).not.toBe('questions');
  });

  it('runs the icp agent when questions are clear but no icp has been materialized', () => {
    expect(deriveConciergeStep({ ...BASE, icps: [] })).toBe('running-icp');
  });

  it('skips the icp agent when an icp already exists, regardless of run history', () => {
    expect(
      deriveConciergeStep({ ...BASE, icps: [{}], runs: { ...BASE.runs, 'propose-icp': undefined } }),
    ).not.toBe('running-icp');
  });

  it('runs the goal agent once the icp is ready but the goal was never proposed', () => {
    expect(deriveConciergeStep({ ...BASE, goals: [], runs: { ...BASE.runs, 'propose-goal': undefined } })).toBe(
      'running-goal',
    );
  });

  it('skips the goal agent when a goal already exists, regardless of run history', () => {
    expect(
      deriveConciergeStep({ ...BASE, goals: [{ status: 'ACTIVE' }], runs: { ...BASE.runs, 'propose-goal': undefined } }),
    ).not.toBe('running-goal');
  });

  it('lands on review once the chain is done but the goal is not yet active', () => {
    expect(deriveConciergeStep({ ...BASE, goals: [{ status: 'DRAFT' }] })).toBe('review');
  });

  it('lands on review when the goal is active but research was never started (approval partway through)', () => {
    expect(
      deriveConciergeStep({
        ...BASE,
        goals: [{ status: 'ACTIVE' }],
        runs: { ...BASE.runs, 'research-growth-context': undefined },
      }),
    ).toBe('review');
  });

  it('is done once an active goal exists and research has been started for it', () => {
    expect(deriveConciergeStep(BASE)).toBe('done');
  });

  it('is done even while the research run is still in flight, not just once it completes', () => {
    expect(deriveConciergeStep({ ...BASE, runs: { ...BASE.runs, 'research-growth-context': 'RUNNING' } })).toBe(
      'done',
    );
  });

  it('is deterministic: the same snapshot always resolves the same step (what makes reload-and-resume work)', () => {
    const snapshot: ConciergeInput = { ...BASE, goals: [{ status: 'DRAFT' }] };
    expect(deriveConciergeStep(snapshot)).toBe(deriveConciergeStep({ ...snapshot }));
  });
});

describe('conciergeMacroStage', () => {
  it('is stage 1 only for the url form', () => {
    expect(conciergeMacroStage('ask-url')).toBe(1);
  });

  it('is stage 2 for every automatic run and the question screen', () => {
    expect(conciergeMacroStage('running-profile')).toBe(2);
    expect(conciergeMacroStage('running-context')).toBe(2);
    expect(conciergeMacroStage('questions')).toBe(2);
    expect(conciergeMacroStage('running-icp')).toBe(2);
    expect(conciergeMacroStage('running-goal')).toBe(2);
  });

  it('is stage 3 for review and done', () => {
    expect(conciergeMacroStage('review')).toBe(3);
    expect(conciergeMacroStage('done')).toBe(3);
  });
});

describe('questionsDoneStorageKey', () => {
  it('is namespaced per business', () => {
    expect(questionsDoneStorageKey('biz-1')).toBe('aurea.concierge.questionsDone.biz-1');
    expect(questionsDoneStorageKey('biz-2')).not.toBe(questionsDoneStorageKey('biz-1'));
  });
});
