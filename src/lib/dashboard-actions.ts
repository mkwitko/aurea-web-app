import type { NextActionKindEnumKey, RecentRefTypeEnumKey } from '@/api/generated/types/GetDashboard';

export type NextActionKey = NextActionKindEnumKey;
export type RecentRefTypeKey = RecentRefTypeEnumKey;

export interface NextActionRoute {
  /** Where the button goes, or null when this kind has no action at all. */
  to: string | null;
  i18nKey: string;
}

type RouteIds = { experimentId: string | null };

/** Kinds whose action is on the experiment's own detail page. */
function onExperimentDetail(ids: RouteIds): string | null {
  return ids.experimentId ? `/app/experiments/${ids.experimentId}` : '/app/experiments';
}

/**
 * One resolver per kind, total over `NextActionKey` — TypeScript rejects this
 * object literal if a key is missing, renamed, or misspelled. So when the
 * server adds a 17th kind, `NextActionKindEnumKey` widens on the next
 * `pnpm api:generate`, and this literal fails to typecheck until someone adds
 * a case for it. There is deliberately no catch-all branch.
 */
const ROUTES: Record<NextActionKey, (ids: RouteIds) => string | null> = {
  // Only sent when no business exists, so the setup screen is the only target.
  SET_UP_BUSINESS: () => '/app/business/profile',
  FILL_CONTEXT: () => '/app/business',
  DEFINE_ICP: () => '/app/icps/new',
  SET_GOAL: () => '/app/goals/new',
  // O rascunho a ativar está na lista, e ativar é uma ação da própria linha.
  // Estas quatro apontam para a página fundida do Crescimento (Fase 4): em
  // modo simples é a única forma de chegar lá; em modo avançado `<ListRoute>`
  // ainda existe, mas a página fundida é o destino natural de uma ação do
  // dashboard, que não sabe em que modo o fundador está.
  ACTIVATE_GOAL: () => '/app/growth/goals',
  RUN_RESEARCH: () => '/app/growth/research',
  CHOOSE_STRATEGY: () => '/app/growth/strategies',
  CREATE_HYPOTHESIS: () => '/app/growth/strategies',
  DESIGN_EXPERIMENT: () => '/app/experiments/new',
  START_NEXT_LOOP: () => '/app/experiments/new',
  // A stage with no action. Rendered as text, never as a dead button.
  WAIT_FOR_EXPERIMENT: () => null,
  // Outcomes and learnings are sections on that page, not screens of their own.
  PLAN_EXPERIMENT: onExperimentDetail,
  APPROVE_EXPERIMENT: onExperimentDetail,
  START_EXPERIMENT: onExperimentDetail,
  RESUME_EXPERIMENT: onExperimentDetail,
  COMPLETE_EXPERIMENT: onExperimentDetail,
  RECORD_OUTCOME: onExperimentDetail,
  INTERPRET_OUTCOME: onExperimentDetail,
  VALIDATE_LEARNING: onExperimentDetail,
};

/**
 * Every kind this module routes, derived from `ROUTES` (never retyped) so it
 * cannot drift from the implementation above. Exported only so the test can
 * compare its own hand-written kind list against this and red-line when a
 * kind was added to `ROUTES` — compiler-forced — but the test list was not
 * updated to match.
 */
export const NEXT_ACTION_KINDS: readonly NextActionKey[] = Object.keys(ROUTES) as NextActionKey[];

/**
 * The only place in the web app that knows what a `nextAction.kind` means in
 * terms of routes. The backend deliberately sends no URLs (spec §3.4), so a
 * route change is one edit here.
 *
 * `ROUTES` is total over the *compiled* union, not over what actually arrives
 * on the wire: an older backend (or a cached SPA bundle talking to a newer
 * one) can send a `kind` this build has never heard of. Nothing upstream
 * validates that value, and there is no `ErrorBoundary` in this app, so an
 * unguarded `ROUTES[kind]` would throw a `TypeError` while rendering
 * `NextActionCard` and blank the whole `/app` page. The `?? (() => null)`
 * fallback keeps `ROUTES` itself total and fully typed (no index signature,
 * no widened `Record` — that would silently accept a typo at compile time,
 * which an earlier review round already rejected) while making the *runtime*
 * lookup safe for a value the compiler cannot see.
 */
export function nextActionRoute(kind: NextActionKey, ids: RouteIds): NextActionRoute {
  const resolve = ROUTES[kind] ?? (() => null);
  return { to: resolve(ids), i18nKey: `app.dashboard.next.${kind}` };
}

/** Where a recent-activity row links. */
export function recentHref(refType: RecentRefTypeKey, refId: string): string | null {
  switch (refType) {
    case 'STRATEGY':
      return `/app/strategies/${refId}`;
    case 'EXPERIMENT':
      return `/app/experiments/${refId}`;
    case 'GOAL':
      // No goal detail page exists; the merged Crescimento page is the
      // honest target (see Fase 4's `/app/growth/<stage>`).
      return '/app/growth/goals';
    case 'OUTCOME':
    case 'LEARNING':
      // Both live in sections of an experiment, and the row does not carry
      // the experiment id — so the list is the target, now the merged one.
      return '/app/growth/experiments';
    case 'AGENT_RUN':
      return '/app/growth/research';
  }
}
