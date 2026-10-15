import { describe, expect, it } from 'vitest';
import { NEXT_ACTION_KINDS, nextActionRoute, recentHref, type NextActionKey, type RecentRefTypeKey } from './dashboard-actions';

const EXPERIMENT_ID = 'e1';

/**
 * Every kind the backend can send. Listed literally rather than derived from
 * the generated type, so adding a kind on the server fails this test until
 * someone decides where it should route.
 */
const ALL_KINDS: NextActionKey[] = [
  'SET_UP_BUSINESS',
  'FILL_CONTEXT',
  'DEFINE_ICP',
  'SET_GOAL',
  'ACTIVATE_GOAL',
  'RUN_RESEARCH',
  'CHOOSE_STRATEGY',
  'CREATE_HYPOTHESIS',
  'DESIGN_EXPERIMENT',
  'PLAN_EXPERIMENT',
  'APPROVE_EXPERIMENT',
  'START_EXPERIMENT',
  'WAIT_FOR_EXPERIMENT',
  'COMPLETE_EXPERIMENT',
  'RESUME_EXPERIMENT',
  'RECORD_OUTCOME',
  'INTERPRET_OUTCOME',
  'VALIDATE_LEARNING',
  'START_NEXT_LOOP',
];

describe('nextActionRoute', () => {
  it('ALL_KINDS matches every kind the implementation actually routes', () => {
    // NEXT_ACTION_KINDS is derived from the implementation's own routing
    // table, which TypeScript forces to stay total over NextActionKey. If a
    // kind is added there but someone forgets to add it to ALL_KINDS above
    // (or vice versa), this goes red instead of silently under-testing.
    expect(ALL_KINDS.length).toBe(NEXT_ACTION_KINDS.length);
    expect(new Set(ALL_KINDS)).toEqual(new Set(NEXT_ACTION_KINDS));
  });

  it('routes every kind, and names a copy key for every one', () => {
    for (const kind of ALL_KINDS) {
      const route = nextActionRoute(kind, { experimentId: EXPERIMENT_ID });
      expect(route.i18nKey, `${kind} has no copy key`).toBe(`app.dashboard.next.${kind}`);
    }
  });

  it.each([
    ['SET_UP_BUSINESS', '/app/business/profile'],
    ['FILL_CONTEXT', '/app/business'],
    ['DEFINE_ICP', '/app/icps/new'],
    ['SET_GOAL', '/app/goals/new'],
    ['ACTIVATE_GOAL', '/app/growth/goals'],
    ['RUN_RESEARCH', '/app/growth/research'],
    ['CHOOSE_STRATEGY', '/app/growth/strategies'],
    ['CREATE_HYPOTHESIS', '/app/growth/strategies'],
    ['DESIGN_EXPERIMENT', '/app/experiments/new'],
    ['START_NEXT_LOOP', '/app/experiments/new'],
  ] as const)('%s goes to %s', (kind, to) => {
    expect(nextActionRoute(kind, { experimentId: null }).to).toBe(to);
  });

  it.each([
    'PLAN_EXPERIMENT',
    'APPROVE_EXPERIMENT',
    'START_EXPERIMENT',
    'RESUME_EXPERIMENT',
    'COMPLETE_EXPERIMENT',
    'RECORD_OUTCOME',
    'INTERPRET_OUTCOME',
    'VALIDATE_LEARNING',
  ] as const)('%s goes to the experiment it names', (kind) => {
    // Outcomes and learnings live in sections on the experiment detail page,
    // so all of these land there.
    expect(nextActionRoute(kind, { experimentId: EXPERIMENT_ID }).to).toBe('/app/experiments/e1');
  });

  it('has nowhere to send a waiting founder', () => {
    // WAIT_FOR_EXPERIMENT is a stage with no action: it renders as text.
    expect(nextActionRoute('WAIT_FOR_EXPERIMENT', { experimentId: EXPERIMENT_ID }).to).toBeNull();
  });

  it('falls back to the experiment list when the id is missing', () => {
    // Should not happen — the backend sends experimentId with all of these —
    // but a dead link is worse than a list.
    expect(nextActionRoute('RECORD_OUTCOME', { experimentId: null }).to).toBe('/app/experiments');
  });

  it('yields no route instead of throwing for a kind this build does not know', () => {
    // `ROUTES` is total over the compiled `NextActionKey` union, but nothing
    // validates the value that actually arrives on the wire. An older
    // backend, or a newer one talking to a cached SPA bundle, can send a kind
    // this build never compiled a case for — this simulates exactly that,
    // since TypeScript would otherwise refuse to let the test construct it.
    const unknownKind = 'SOME_FUTURE_KIND' as NextActionKey;
    expect(() => nextActionRoute(unknownKind, { experimentId: EXPERIMENT_ID })).not.toThrow();
    expect(nextActionRoute(unknownKind, { experimentId: EXPERIMENT_ID }).to).toBeNull();
  });
});

describe('recentHref', () => {
  it.each([
    ['GOAL', '/app/growth/goals'],
    ['STRATEGY', '/app/strategies/s1'],
    ['EXPERIMENT', '/app/experiments/s1'],
    ['LEARNING', '/app/growth/experiments'],
    ['OUTCOME', '/app/growth/experiments'],
  ] as const)('links a %s', (refType, href) => {
    expect(recentHref(refType as RecentRefTypeKey, 's1')).toBe(href);
  });

  it('does not link an agent run', () => {
    // There is no per-run page; research history lives on the merged
    // Crescimento page's research stage.
    expect(recentHref('AGENT_RUN', 'r1')).toBe('/app/growth/research');
  });
});
