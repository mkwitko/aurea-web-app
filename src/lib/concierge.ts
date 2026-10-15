/**
 * The 3-step concierge's state machine.
 *
 * Pure and server-state-only by design: every input here is something the
 * server already told the app (a business, a run's status, an entity list),
 * never local component state. That is what makes "reload at any point
 * recalculates and resumes" true — `OnboardingPage` calls this on every
 * render with whatever it currently has, and gets back the one step to show.
 *
 * The one piece of state that is NOT server-held is whether the founder has
 * already been through the question screen (`questionsDone`) — see the note
 * on `questionsDoneStorageKey` below for why that lives in `localStorage`
 * instead of being derived.
 */

export type ConciergeStep =
  | 'ask-url'
  | 'running-profile'
  | 'running-context'
  | 'questions'
  | 'running-icp'
  | 'running-goal'
  | 'review'
  | 'done';

/**
 * The chain's four automatic AI runs, keyed the same as the backend's
 * `taskType`. `research-growth-context` is not part of the chain itself (it
 * fires once at approval, from the review step) but its presence is what
 * tells a reloading founder the concierge is over.
 */
export type ConciergeTaskType =
  | 'propose-business-profile'
  | 'propose-business-context'
  | 'propose-icp'
  | 'propose-goal'
  | 'research-growth-context';

/**
 * What this module needs to know about a run, collapsed from the five
 * backend statuses (`PENDING`/`RUNNING`/`COMPLETED`/`FAILED`/`CANCELLED`) down
 * to the three that change a step decision. `undefined` means no run of that
 * task type exists yet (or none has ever completed for it) — `useFillRun`'s
 * `idle` state maps to this. The step machine never needs to tell a pending
 * run from a running one, or a failed one from a cancelled one: whichever
 * screen is showing that stage renders that distinction itself (a spinner vs.
 * a retryable error card), while the step stays put either way — see
 * `OnboardingPage`'s comment on why a failure never changes the step.
 */
export type ConciergeRunSignal = 'RUNNING' | 'COMPLETED' | 'FAILED' | undefined;

export interface ConciergeGoalLike {
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
}

export interface ConciergeInput {
  /** `null` before the founder has submitted the ask-url form. */
  business: { id: string } | null;
  /**
   * The latest run's status per task type. Only the newest run of a type
   * matters — an earlier failed attempt the founder already retried past is
   * not this module's concern.
   */
  runs: Partial<Record<ConciergeTaskType, ConciergeRunSignal>>;
  /**
   * How many of the seven AI-fillable context sections
   * (`AI_FILLABLE_CONTEXT_SECTIONS`) already hold data, straight off
   * `GET /business/context`. This exists only as an escape hatch: a business
   * whose context was filled before the concierge existed (the old 8-step
   * wizard, or a manual edit) has no `propose-business-context` run to point
   * to, and without this the machine would force a redundant AI run over
   * data that is already there.
   */
  filledContextSections: number;
  /** Every ICP in the workspace. Only its length matters here — see `icpReady` below. */
  icps: readonly unknown[];
  /** Every goal in the workspace, status included — `done` needs an ACTIVE one. */
  goals: readonly ConciergeGoalLike[];
  /**
   * Whether the merged profile+context question set (see
   * `OnboardingPage`) still has at least one question this run that has not
   * been answered, "don't know"-resolved, or is not simply absent.
   */
  questionsPending: boolean;
  /** Read from `localStorage` at `questionsDoneStorageKey(business.id)`. */
  questionsDone: boolean;
}

/**
 * The seven sections `propose-business-context` can write:
 * companyProfile, products, competitiveLandscape, marketContext,
 * constraints, currentPerformance, currentActivities — mirrors
 * `AI_FILLED_SECTION_COUNT` in
 * `src/components/BusinessContextWizard/sectionRegistry.ts`. Duplicated
 * rather than imported: that module pulls in the whole step-component tree,
 * which this pure, framework-free lib must not depend on (same rationale as
 * `src/lib/fill-paths.ts`'s deliberate copies of backend constants).
 */
export const AI_FILLABLE_CONTEXT_SECTIONS = 7;

/** Where "the founder has been through (or skipped) the question screen once" lives. */
export function questionsDoneStorageKey(businessId: string): string {
  return `aurea.concierge.questionsDone.${businessId}`;
}

/**
 * The one function the whole concierge is built around: given everything the
 * server currently says, which of the three macro-screens (and which
 * sub-stage within "AUREA builds your Growth Brain") should be on screen.
 *
 * Order matters — each `if` is a gate the founder cannot be past without
 * having cleared it, and the first ungated one wins:
 *
 * 1. No business at all → `ask-url`.
 * 2. Business exists, profile run never completed → `running-profile`
 *    (`OnboardingPage` fires it automatically on arrival).
 * 3. Profile done, context not applied yet → `running-context`. "Applied"
 *    is satisfied by either a completed run OR the section count escape
 *    hatch above — either way the founder never sees a second AI pass over
 *    data that already exists.
 * 4. Profile and context both done, and there is at least one merged
 *    question still open and not yet dismissed → `questions`. Only one
 *    interstitial exists for both agents' questions (see the field comment
 *    on `questionsPending`): `propose-business-profile` is wired with
 *    `NO_FILL_PATHS` today and so never actually asks anything, but folding
 *    it into the same merge keeps this machine correct if that ever changes,
 *    without adding a step nobody would use.
 * 5. Questions resolved (or none to begin with), no ICP materialized yet →
 *    `running-icp`. Gated on `icps.length`, not on the run's own status: this
 *    concierge always creates the ICP the moment `propose-icp` completes (see
 *    `OnboardingPage`) so a real id exists to hand `propose-goal` — the
 *    backend takes an ICP id, not a proposal, there. Gating on materialization
 *    rather than run status also means a workspace that already has an ICP
 *    from before this concierge existed skips straight past this stage.
 * 6. ICP ready, goal not yet proposed → `running-goal`. The goal itself is
 *    NOT created here — only proposed — so this has to fall back to the run's
 *    own status; `goals.length > 0` is the same kind of pre-existing-data
 *    escape hatch as step 5's.
 * 7. Everything above cleared, but there is no ACTIVE goal with a research run
 *    started for it yet → `review`. This is deliberately a catch-all rather
 *    than one specific condition: it is where a reload lands whether the
 *    founder never opened "Approve everything" yet, opened it and it failed
 *    partway (goal created but not activated, say), or activated the goal but
 *    the research call itself never went out — `OnboardingPage`'s approve
 *    handler resumes from whichever of those sub-steps is still missing
 *    rather than starting over.
 * 8. An ACTIVE goal exists AND a research run has been started for this
 *    workspace → `done`. "Started", not "completed": the research itself can
 *    take a while, and the concierge's job ends the moment it is launched —
 *    the dashboard is where its progress and result live.
 */
export function deriveConciergeStep(input: ConciergeInput): ConciergeStep {
  if (!input.business) return 'ask-url';

  const profileDone = input.runs['propose-business-profile'] === 'COMPLETED';
  if (!profileDone) return 'running-profile';

  const contextApplied =
    input.runs['propose-business-context'] === 'COMPLETED' ||
    input.filledContextSections >= AI_FILLABLE_CONTEXT_SECTIONS;
  if (!contextApplied) return 'running-context';

  if (input.questionsPending && !input.questionsDone) return 'questions';

  const icpReady = input.icps.length > 0;
  if (!icpReady) return 'running-icp';

  const goalProposed = input.runs['propose-goal'] === 'COMPLETED' || input.goals.length > 0;
  if (!goalProposed) return 'running-goal';

  const activeGoal = input.goals.some((goal) => goal.status === 'ACTIVE');
  const researchStarted = input.runs['research-growth-context'] !== undefined;
  if (activeGoal && researchStarted) return 'done';

  return 'review';
}

/**
 * The three macro-stages `OnboardingPage`'s progress indicator shows: "tell
 * us who you are" (the url form), "AUREA builds your Growth Brain" (every
 * automatic run in between), "review and approve" (the last screen, and the
 * done state right after it).
 */
export type ConciergeMacroStage = 1 | 2 | 3;

export function conciergeMacroStage(step: ConciergeStep): ConciergeMacroStage {
  if (step === 'ask-url') return 1;
  if (step === 'review' || step === 'done') return 3;
  return 2;
}
