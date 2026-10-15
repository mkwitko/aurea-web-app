import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Check, Loader2 } from 'lucide-react';

import { useGetDashboard } from '@/api/generated/hooks/dashboardHooks/useGetDashboard';
import { useGetBusiness } from '@/api/generated/hooks/businessHooks/useGetBusiness';
import { useGetBusinessContext } from '@/api/generated/hooks/businessHooks/useGetBusinessContext';
import { useCreateBusiness } from '@/api/generated/hooks/businessHooks/useCreateBusiness';
import { useUpdateBusiness } from '@/api/generated/hooks/businessHooks/useUpdateBusiness';
import { useUpdateBusinessContextSection } from '@/api/generated/hooks/businessHooks/useUpdateBusinessContextSection';
import type { UpdateBusinessContextSectionMutationRequest } from '@/api/generated/types/UpdateBusinessContextSection';
import { useListIcps } from '@/api/generated/hooks/icpsHooks/useListIcps';
import { useCreateIcp } from '@/api/generated/hooks/icpsHooks/useCreateIcp';
import { useUpdateIcp } from '@/api/generated/hooks/icpsHooks/useUpdateIcp';
import { useListGoals } from '@/api/generated/hooks/goalsHooks/useListGoals';
import { useCreateGoal } from '@/api/generated/hooks/goalsHooks/useCreateGoal';
import { useActivateGoal } from '@/api/generated/hooks/goalsHooks/useActivateGoal';
import { useCreateAgentRun } from '@/api/generated/hooks/agent-runsHooks/useCreateAgentRun';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { useGetCreditPricing } from '@/api/generated/hooks/creditsHooks/useGetCreditPricing';

import { BUSINESS, ICPS, GOALS, DASHBOARD, AGENT_RUNS } from '@/api/modules';
import { useAuth } from '@/lib/auth';
import { apiErrorMessage } from '@/lib/api-errors';
import { availableCredits } from '@/lib/credits';
import { filledSectionCount } from '@/lib/context-completeness';
import { CONTEXT_FILL_PATHS, GOAL_FILL_PATHS, NO_FILL_PATHS } from '@/lib/fill-paths';
import { parseFillProposal, sortByImpact, type FillQuestion } from '@/schemas/fill-proposal';
import { conciergeStartSchema, type ConciergeStartValues } from '@/schemas/concierge';
import {
  conciergeMacroStage,
  deriveConciergeStep,
  questionsDoneStorageKey,
  type ConciergeMacroStage,
  type ConciergeRunSignal,
  type ConciergeStep,
} from '@/lib/concierge';
import { AI_FILLED_SECTION_COUNT, CONTEXT_SECTIONS } from '@/components/BusinessContextWizard/sectionRegistry';
import { BUSINESS_LIMITS } from '@/schemas/business';
import type { BusinessContextData, ContextSection } from '@/types/business-context';

import { useFillRun, type UseFillRun } from '@/components/ai/useFillRun';
import { AiFillPanel } from '@/components/ai/AiFillPanel';
import { RunningRunCard } from '@/components/ai/RunningRunCard';
import { SpecialistByline, type Specialist } from '@/components/ai/SpecialistByline';
import { FillErrorCard } from '@/components/ai/FillErrorCard';
import { PageHeader } from '@/components/PageHeader';
import { Help } from '@/components/Help';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TextField } from '@/components/form/TextField';
import { NumberField } from '@/components/form/NumberField';
import { SelectField } from '@/components/form/SelectField';

const GOAL_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
type GoalPriority = (typeof GOAL_PRIORITIES)[number];

const CHAIN_TASK_TYPES = [
  'propose-business-profile',
  'propose-business-context',
  'propose-icp',
  'propose-goal',
] as const;

/**
 * The six fields `propose-business-profile` can fill, all optional — mirrors
 * the schema of the same name in `BusinessProfileForm.tsx` (deliberate copy,
 * same rationale as every other fill-path duplication in this codebase: the
 * two repos share no code, and the server already validated the shape).
 */
const profileFilledSchema = z.object({
  description: z.string().optional(),
  industry: z.string().optional(),
  businessModel: z.string().optional(),
  revenueModel: z.string().optional(),
  valueProposition: z.string().optional(),
  positioning: z.string().optional(),
});

/** Mirrors `IcpNewPage.tsx`'s local schema for `propose-icp`'s output. */
const icpFilledSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  painPoints: z.array(z.string()).optional(),
  characteristics: z.array(z.string()).optional(),
  customerGoals: z.array(z.string()).optional(),
  buyingTriggers: z.array(z.string()).optional(),
  objections: z.array(z.string()).optional(),
});

/** Mirrors `GoalNewPage.tsx`'s local schema for `propose-goal`'s output. */
const goalFilledSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  metric: z.string().optional(),
  unit: z.string().optional(),
  baselineValue: z.number().optional(),
  priority: z.enum(GOAL_PRIORITIES).optional(),
});

/** The field each context section lives under, inverted from `SECTION_FIELD` — reused to route a question's `fills` path back to a section to PATCH. */
const FIELD_TO_SECTION = new Map<string, ContextSection>(
  CONTEXT_SECTIONS.filter((s) => s.field !== undefined).map((s) => [s.field as string, s.key]),
);

/** Immutable deep-set, one path segment at a time — how a single answered question's value lands inside its section's existing object. */
function setNestedValue(source: Record<string, unknown>, path: readonly string[], value: unknown): Record<string, unknown> {
  const [head, ...rest] = path;
  if (!head) return source;
  if (rest.length === 0) return { ...source, [head]: value };
  const child = (source[head] as Record<string, unknown> | undefined) ?? {};
  return { ...source, [head]: setNestedValue(child, rest, value) };
}

function isBusinessId(input: unknown, businessId: string): boolean {
  return typeof input === 'object' && input !== null && (input as { businessId?: unknown }).businessId === businessId;
}

/** Maps `useFillRun`'s five-state machine down to the three-value signal `concierge.ts` reasons about. */
function toRunSignal(run: UseFillRun): ConciergeRunSignal {
  if (run.state === 'done') return 'COMPLETED';
  if (run.state === 'failed') return 'FAILED';
  if (run.state === 'starting' || run.state === 'running') return 'RUNNING';
  return undefined;
}

/** The three macro-stages, always visible, so a founder never wonders "how much is left". */
function ConciergeProgress({ stage }: { stage: ConciergeMacroStage }) {
  const { t } = useTranslation();
  const stages: ConciergeMacroStage[] = [1, 2, 3];
  return (
    <div className="mb-8 flex items-center gap-2">
      {stages.map((s) => (
        <div key={s} className="flex flex-1 items-center gap-2">
          <div
            className={`grid size-7 shrink-0 place-items-center rounded-full border font-mono text-[11px] ${
              s < stage
                ? 'border-transparent bg-gradient-to-br from-brand to-aura text-white'
                : s === stage
                  ? 'border-primary text-primary'
                  : 'border-border text-muted-foreground'
            }`}
          >
            {s < stage ? <Check className="size-3.5" /> : s}
          </div>
          <span className={`text-xs ${s === stage ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
            {t(`onboarding.stage.${s}`)}
          </span>
          {s < 3 && <div className={`h-px flex-1 ${s < stage ? 'bg-aura' : 'bg-border'}`} />}
        </div>
      ))}
    </div>
  );
}

/** One stage of the automatic chain, live: who is working, and — only when there is something to say — a spinner, a timer, or a retryable error. */
function ChainRunCard({ specialist, run, title }: { specialist: Specialist; run: UseFillRun; title: string }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <p className="text-sm font-medium">{title}</p>
        <SpecialistByline specialist={specialist} />
        {run.state === 'running' ? (
          <RunningRunCard
            startedAt={run.startedAt}
            isForeign={run.isForeign}
            onCancel={run.cancel}
            isCancelling={run.isCancelling}
          />
        ) : run.state === 'failed' ? (
          <FillErrorCard
            title={t('onboarding.chain.failedTitle')}
            body={run.error ?? t('ai.fill.failed')}
            note={t('ai.fill.error.refunded')}
          >
            <Button size="sm" onClick={run.start} disabled={run.isStarting}>
              {t('ai.fill.retry')}
            </Button>
          </FillErrorCard>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t('ai.fill.thinking')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The concierge: three screens instead of the old eight-step guide.
 *
 * `deriveConciergeStep` (a pure function, see `src/lib/concierge.ts`) is the
 * single source of truth for which of them is on screen — this component's
 * only jobs are fetching what that function needs, firing each chain stage's
 * run when its turn comes, applying what a completed run produced, and
 * rendering whatever step comes back. That split is what makes "reload at
 * any point resumes" true: nothing about progress lives in this component's
 * own state, only in the server (business, runs, ICPs, goals) and one
 * `localStorage` flag for the question screen (see `concierge.ts`'s comment
 * on `questionsDone`).
 */
export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();

  const dashboard = useGetDashboard();
  const businessQuery = useGetBusiness();
  const business = businessQuery.data?.business ?? null;
  const contextQuery = useGetBusinessContext({ query: { enabled: business !== null } });
  const icpsQuery = useListIcps();
  const goalsQuery = useListGoals();
  const credits = useGetCredits();
  const pricing = useGetCreditPricing();

  // Guards read before the effects below so every one of them can bail
  // without doing the work of a page the founder is about to be routed away
  // from (a VIEWER, or a workspace whose setup is already done).
  const viewerBlocked = role === 'VIEWER';
  const setupComplete = dashboard.data ? dashboard.data.setup.completed === dashboard.data.setup.total : false;
  const skip = viewerBlocked || setupComplete;

  const matchesBusiness = (input: unknown) => (business ? isBusinessId(input, business.id) : false);

  const profileRun = useFillRun({
    taskType: 'propose-business-profile',
    input: business ? { businessId: business.id, website: business.website ?? '' } : null,
    matchesInput: matchesBusiness,
    startFailedMessage: t('ai.fill.startFailed'),
  });
  const contextRun = useFillRun({
    taskType: 'propose-business-context',
    input: business ? { businessId: business.id } : null,
    matchesInput: matchesBusiness,
    startFailedMessage: t('ai.fill.startFailed'),
  });
  const icpsForGoal = icpsQuery.data?.icps ?? [];
  const materializedIcp = icpsForGoal[0] ?? null;
  const icpRun = useFillRun({
    taskType: 'propose-icp',
    input: business ? { businessId: business.id } : null,
    matchesInput: matchesBusiness,
    startFailedMessage: t('ai.fill.startFailed'),
  });
  const goalRun = useFillRun({
    taskType: 'propose-goal',
    input: business && materializedIcp ? { businessId: business.id, icpId: materializedIcp.id } : null,
    matchesInput: (input) =>
      typeof input === 'object' &&
      input !== null &&
      (input as { businessId?: unknown }).businessId === business?.id &&
      (input as { icpId?: unknown }).icpId === materializedIcp?.id,
    startFailedMessage: t('ai.fill.startFailed'),
  });

  const createBusiness = useCreateBusiness({
    mutation: {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: BUSINESS.queryKeyRoot }),
    },
  });
  const updateBusiness = useUpdateBusiness({
    mutation: {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: BUSINESS.queryKeyRoot }),
    },
  });
  const updateContextSection = useUpdateBusinessContextSection({
    mutation: {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: BUSINESS.contextQueryKey }),
    },
  });
  const createIcp = useCreateIcp({
    mutation: {
      onSuccess: () => void queryClient.invalidateQueries({ queryKey: ICPS.queryKeyRoot }),
    },
  });
  const updateIcp = useUpdateIcp();
  const createGoal = useCreateGoal();
  const activateGoal = useActivateGoal();
  const createResearchRun = useCreateAgentRun();

  const [justFinishedQuestions, setJustFinishedQuestions] = useState(false);
  const persistedQuestionsDone = business ? localStorage.getItem(questionsDoneStorageKey(business.id)) === '1' : false;
  const questionsDone = justFinishedQuestions || persistedQuestionsDone;
  const markQuestionsDone = () => {
    if (business) localStorage.setItem(questionsDoneStorageKey(business.id), '1');
    setJustFinishedQuestions(true);
  };

  interface IcpDraft {
    name: string;
    description: string;
  }
  const [icpDraft, setIcpDraft] = useState<IcpDraft | null>(null);

  interface GoalDraft {
    name: string;
    description: string;
    metric: string;
    baselineValue: number | undefined;
    targetValue: number | undefined;
    unit: string;
    deadline: string;
    priority: GoalPriority | undefined;
  }
  const [goalDraft, setGoalDraft] = useState<GoalDraft | null>(null);

  const [approveProgress, setApproveProgress] = useState<{
    icpSaved: boolean;
    goalId: string | null;
    activated: boolean;
    researchStarted: boolean;
  }>({ icpSaved: false, goalId: null, activated: false, researchStarted: false });
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);

  const urlForm = useForm<ConciergeStartValues>({
    resolver: zodResolver(conciergeStartSchema),
    defaultValues: { name: '', website: '' },
  });

  // Fires each chain stage's run the moment its turn comes and nothing is
  // already running or adopted for it — `useFillRun`'s own adoption (see its
  // module comment) already recovers an in-flight or just-finished run on
  // reload independent of this effect, so this only ever needs to cover the
  // very first "nobody has asked yet" case.
  useEffect(() => {
    if (skip || !business || profileRun.state !== 'idle') return;
    profileRun.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, business, profileRun.state]);

  useEffect(() => {
    if (skip || !business || profileRun.state !== 'done' || contextRun.state !== 'idle') return;
    contextRun.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, business, profileRun.state, contextRun.state]);

  useEffect(() => {
    if (skip || !business || contextRun.state !== 'done' || icpRun.state !== 'idle') return;
    icpRun.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, business, contextRun.state, icpRun.state]);

  useEffect(() => {
    if (skip || !materializedIcp || goalRun.state !== 'idle') return;
    goalRun.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, materializedIcp, goalRun.state]);

  // Applies `propose-business-profile`'s proposal to the business — only
  // into fields still empty, never over what the founder just typed on the
  // url form (the name always survives this untouched: it is not part of
  // `profileFilledSchema` at all).
  const appliedProfileRun = useRef<string | null>(null);
  useEffect(() => {
    if (skip || !business || profileRun.state !== 'done' || !profileRun.runId) return;
    if (appliedProfileRun.current === profileRun.runId) return;
    appliedProfileRun.current = profileRun.runId;
    const proposal = parseFillProposal(profileRun.output, NO_FILL_PATHS);
    const parsed = proposal.ok ? profileFilledSchema.safeParse(proposal.value.filled) : null;
    if (!parsed?.success) return;
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) continue;
      const current = (business as unknown as Record<string, unknown>)[key];
      if (current === null || current === undefined || current === '') patch[key] = value;
    }
    if (Object.keys(patch).length > 0) updateBusiness.mutate({ data: patch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, business, profileRun.state, profileRun.runId]);

  // `propose-business-context` auto-applies its seven sections on the server
  // the moment it completes (see the backend note in this feature's spec) —
  // this effect only has to refresh what is already cached, never write
  // anything itself.
  const appliedContextRun = useRef<string | null>(null);
  useEffect(() => {
    if (skip || contextRun.state !== 'done' || !contextRun.runId) return;
    if (appliedContextRun.current === contextRun.runId) return;
    appliedContextRun.current = contextRun.runId;
    void queryClient.invalidateQueries({ queryKey: BUSINESS.queryKeyRoot });
    void queryClient.invalidateQueries({ queryKey: BUSINESS.contextQueryKey });
    void queryClient.invalidateQueries({ queryKey: DASHBOARD.queryKeyRoot });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, contextRun.state, contextRun.runId]);

  // The one place this concierge creates the ICP: the moment `propose-icp`
  // completes, straight from its proposal, with no review yet. This is a
  // deliberate deviation from a literal "review approves the create" reading
  // of the spec — `propose-goal` (the very next chain stage) needs a real,
  // persisted ICP id, not a proposal, so an ICP has to exist before that run
  // can even start. The review screen still lets the founder edit it
  // (`useUpdateIcp`) before "Approve everything"; what moved earlier is only
  // *that a row exists*, not the founder's chance to change it.
  const materializingIcp = useRef<string | null>(null);
  useEffect(() => {
    if (skip || icpRun.state !== 'done' || !icpRun.runId || icpsForGoal.length > 0) return;
    if (materializingIcp.current === icpRun.runId) return;
    materializingIcp.current = icpRun.runId;
    const proposal = parseFillProposal(icpRun.output, NO_FILL_PATHS);
    const parsed = proposal.ok ? icpFilledSchema.safeParse(proposal.value.filled) : null;
    const filled = parsed?.success ? parsed.data : {};
    createIcp.mutate({
      data: {
        name: filled.name?.trim() ? filled.name : t('onboarding.review.icpFallbackName'),
        description: filled.description,
        painPoints: filled.painPoints ?? [],
        characteristics: filled.characteristics ?? [],
        customerGoals: filled.customerGoals ?? [],
        buyingTriggers: filled.buyingTriggers ?? [],
        objections: filled.objections ?? [],
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, icpRun.state, icpRun.runId, icpsForGoal.length]);

  // Seeds the editable ICP/goal drafts once their source is ready, never
  // again after — same "loaded" guard `BusinessContextSectionPage` uses, so
  // an edit the founder makes is never clobbered by a later re-render of the
  // same proposal.
  useEffect(() => {
    if (icpDraft || !materializedIcp) return;
    setIcpDraft({ name: materializedIcp.name, description: materializedIcp.description ?? '' });
  }, [icpDraft, materializedIcp]);

  useEffect(() => {
    if (goalDraft || goalRun.state !== 'done') return;
    const proposal = parseFillProposal(goalRun.output, GOAL_FILL_PATHS);
    const parsed = proposal.ok ? goalFilledSchema.safeParse(proposal.value.filled) : null;
    const filled = parsed?.success ? parsed.data : {};
    setGoalDraft({
      name: filled.name ?? '',
      description: filled.description ?? '',
      metric: filled.metric ?? '',
      baselineValue: filled.baselineValue,
      targetValue: undefined,
      unit: filled.unit ?? '',
      deadline: '',
      priority: filled.priority,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalDraft, goalRun.state, goalRun.output]);

  const applyContextAnswer = (path: string, value: string | number, runId: string) => {
    const [field, ...rest] = path.split('.');
    const section = field ? FIELD_TO_SECTION.get(field) : undefined;
    if (!section || rest.length === 0 || !field) return;
    const currentData = (contextQuery.data?.currentVersion?.data as Record<string, unknown> | undefined) ?? {};
    const currentSectionValue = (currentData[field] as Record<string, unknown> | undefined) ?? {};
    const updated = setNestedValue(currentSectionValue, rest, value);
    // The generated request type is a discriminated union keyed by the
    // literal `section`, one member per section's own typed shape — exactly
    // what `BusinessContextSectionPage` gets for free by switching on a
    // known section and parsing through that section's own zod schema first.
    // This path answers a single question for whichever section a `fills`
    // path happens to name, so it patches the section's existing (already
    // server-validated) object with one more leaf value rather than
    // constructing a fully-typed section from scratch; the server re-validates
    // on save regardless, same as every other write to this endpoint.
    updateContextSection.mutate({
      data: { section, data: updated, sourceAgentRunId: runId } as UpdateBusinessContextSectionMutationRequest,
    });
  };

  const approveAll = async () => {
    if (approving || !materializedIcp || !icpDraft || !goalDraft) return;
    setApproving(true);
    setApproveError(null);
    try {
      if (!approveProgress.icpSaved) {
        await updateIcp.mutateAsync({
          id: materializedIcp.id,
          data: { name: icpDraft.name, description: icpDraft.description || undefined },
        });
        setApproveProgress((p) => ({ ...p, icpSaved: true }));
      }
      let goalId = approveProgress.goalId;
      if (!goalId) {
        const created = await createGoal.mutateAsync({
          data: {
            name: goalDraft.name,
            description: goalDraft.description || undefined,
            metric: goalDraft.metric,
            baselineValue: goalDraft.baselineValue,
            targetValue: goalDraft.targetValue,
            unit: goalDraft.unit || undefined,
            deadline: goalDraft.deadline ? new Date(goalDraft.deadline) : undefined,
            priority: goalDraft.priority,
            icpIds: [materializedIcp.id],
          },
        });
        goalId = created.goal.id;
        setApproveProgress((p) => ({ ...p, goalId }));
      }
      if (!approveProgress.activated) {
        await activateGoal.mutateAsync({ id: goalId });
        setApproveProgress((p) => ({ ...p, activated: true }));
      }
      if (!approveProgress.researchStarted) {
        await createResearchRun.mutateAsync({ data: { taskType: 'research-growth-context', input: { goalId } } });
        setApproveProgress((p) => ({ ...p, researchStarted: true }));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ICPS.queryKeyRoot }),
        queryClient.invalidateQueries({ queryKey: GOALS.queryKeyRoot }),
        queryClient.invalidateQueries({ queryKey: AGENT_RUNS.queryKeyRoot }),
        queryClient.invalidateQueries({ queryKey: DASHBOARD.queryKeyRoot }),
      ]);
      navigate('/app');
    } catch (error) {
      setApproveError(apiErrorMessage(error, t('onboarding.review.approveFailed')));
    } finally {
      setApproving(false);
    }
  };

  // ─────────────────────────── question set (profile + context, merged) ───
  const profileProposal = parseFillProposal(profileRun.output, NO_FILL_PATHS);
  const contextProposal = parseFillProposal(contextRun.output, CONTEXT_FILL_PATHS);
  const mergedQuestions: FillQuestion[] = [
    ...(profileProposal.ok ? profileProposal.value.questions : []),
    ...(contextProposal.ok ? contextProposal.value.questions : []),
  ];
  const topQuestions = sortByImpact(mergedQuestions).slice(0, 3);

  // ─────────────────────────── the chain cost, shown once, up front ───────
  const chainCost = CHAIN_TASK_TYPES.reduce(
    (sum, taskType) => sum + (pricing.data?.operations.find((o) => o.taskType === taskType)?.credits ?? 0),
    0,
  );
  const balance = credits.data ? availableCredits(credits.data) : null;
  const short = balance !== null && chainCost > 0 && balance < chainCost;

  const loading =
    dashboard.isLoading ||
    businessQuery.isLoading ||
    icpsQuery.isLoading ||
    goalsQuery.isLoading ||
    (business !== null && contextQuery.isLoading);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
      </p>
    );
  }

  if (viewerBlocked || setupComplete) return <Navigate to="/app" replace />;

  const contextVersion = contextQuery.data?.currentVersion;
  const filledSections = filledSectionCount(contextVersion?.data as Record<string, unknown> | undefined);

  const step: ConciergeStep = deriveConciergeStep({
    business: business ? { id: business.id } : null,
    runs: {
      'propose-business-profile': toRunSignal(profileRun),
      'propose-business-context': toRunSignal(contextRun),
      'propose-icp': toRunSignal(icpRun),
      'propose-goal': toRunSignal(goalRun),
      // Not `approveProgress.researchStarted`: that is local component state,
      // gone on reload. `dashboard.data.setup.research` is the server's own
      // record of whether a research run exists for this workspace — the
      // same flag the (untouched) dashboard checklist already reads — and is
      // what makes a reload right after approval still resolve to `done`
      // instead of bouncing back to `review`.
      'research-growth-context': dashboard.data?.setup.research ? 'COMPLETED' : undefined,
    },
    filledContextSections: filledSections,
    icps: icpsForGoal,
    goals: goalsQuery.data?.goals ?? [],
    questionsPending: mergedQuestions.length > 0,
    questionsDone,
  });

  if (step === 'done') return <Navigate to="/app" replace />;

  const stage = conciergeMacroStage(step);

  // ─────────────────────────── ask-url ─────────────────────────────────────
  if (step === 'ask-url') {
    const onSubmit = urlForm.handleSubmit((values) => {
      createBusiness.mutate({ data: { name: values.name, website: values.website } });
    });
    return (
      <div>
        <ConciergeProgress stage={stage} />
        <PageHeader
          eyebrow={t('onboarding.url.eyebrow')}
          title={t('onboarding.url.title')}
          help={<Help title={t('onboarding.url.helpTitle')}>{t('onboarding.url.help')}</Help>}
          subtitle={t('onboarding.url.subtitle')}
        />
        <Card>
          <CardContent className="p-6">
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="concierge-name">{t('onboarding.url.name')}</Label>
                <Input
                  id="concierge-name"
                  maxLength={BUSINESS_LIMITS.name}
                  placeholder={t('onboarding.url.namePh')}
                  {...urlForm.register('name')}
                />
                {urlForm.formState.errors.name && (
                  <p className="text-sm text-destructive">{t(urlForm.formState.errors.name.message ?? '')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="concierge-website">{t('onboarding.url.website')}</Label>
                <Input id="concierge-website" placeholder={t('onboarding.url.websitePh')} {...urlForm.register('website')} />
                {urlForm.formState.errors.website && (
                  <p className="text-sm text-destructive">{t(urlForm.formState.errors.website.message ?? '')}</p>
                )}
              </div>

              {chainCost > 0 && (
                <p className="text-xs text-muted-foreground">{t('onboarding.url.cost', { credits: chainCost })}</p>
              )}
              {short && (
                <p className="text-sm text-destructive">
                  {t('ai.fill.short')}{' '}
                  <a href="/app/settings/billing" className="underline">
                    {t('ai.fill.topUp')}
                  </a>
                </p>
              )}
              {createBusiness.isError && (
                <p className="text-sm text-destructive">{apiErrorMessage(createBusiness.error, t('onboarding.url.failed'))}</p>
              )}

              <Button type="submit" disabled={createBusiness.isPending || short}>
                {createBusiness.isPending ? t('onboarding.url.submitting') : t('onboarding.url.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─────────────────────────── the automatic chain + questions ────────────
  if (step === 'running-profile' || step === 'running-context' || step === 'running-icp' || step === 'running-goal') {
    const cards: Record<typeof step, { specialist: Specialist; run: UseFillRun; titleKey: string }> = {
      'running-profile': { specialist: 'researcher', run: profileRun, titleKey: 'onboarding.chain.profile' },
      'running-context': { specialist: 'researcher', run: contextRun, titleKey: 'onboarding.chain.context' },
      'running-icp': { specialist: 'strategist', run: icpRun, titleKey: 'onboarding.chain.icp' },
      'running-goal': { specialist: 'strategist', run: goalRun, titleKey: 'onboarding.chain.goal' },
    };
    const { specialist, run, titleKey } = cards[step];
    return (
      <div>
        <ConciergeProgress stage={stage} />
        <PageHeader eyebrow={t('onboarding.chain.eyebrow')} title={t('onboarding.chain.title')} subtitle={t('onboarding.chain.subtitle')} />
        <ChainRunCard specialist={specialist} run={run} title={t(titleKey)} />
      </div>
    );
  }

  if (step === 'questions') {
    return (
      <div>
        <ConciergeProgress stage={stage} />
        <PageHeader
          eyebrow={t('onboarding.questions.eyebrow')}
          title={t('onboarding.questions.title')}
          subtitle={t('onboarding.questions.subtitle')}
        />
        <div className="space-y-4">
          <AiFillPanel
            questions={topQuestions}
            onAnswer={(path, value) => {
              const runId = contextRun.runId ?? profileRun.runId ?? '';
              if (runId) applyContextAnswer(path, value, runId);
            }}
            onDone={markQuestionsDone}
          />
          <Button variant="ghost" size="sm" onClick={markQuestionsDone}>
            {t('onboarding.questions.skip')}
          </Button>
        </div>
      </div>
    );
  }

  // ─────────────────────────── review ──────────────────────────────────────
  if (!materializedIcp || !icpDraft || !goalDraft) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
      </p>
    );
  }

  return (
    <div>
      <ConciergeProgress stage={stage} />
      <PageHeader eyebrow={t('onboarding.review.eyebrow')} title={t('onboarding.review.title')} subtitle={t('onboarding.review.subtitle')} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t('onboarding.review.profileTitle')}</p>
              <a href="/app/business/profile" className="text-xs text-primary hover:underline">
                {t('common.edit')}
              </a>
            </div>
            <p className="text-sm">{business?.name}</p>
            {business?.website && <p className="text-sm text-muted-foreground">{business.website}</p>}
            {business?.valueProposition && <p className="text-sm text-muted-foreground">{business.valueProposition}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t('onboarding.review.contextTitle')}</p>
              <a href="/app/business" className="text-xs text-primary hover:underline">
                {t('common.edit')}
              </a>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('onboarding.review.contextSummary', { filled: filledSections, total: AI_FILLED_SECTION_COUNT })}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${contextVersion?.completeness ?? 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium">{t('onboarding.review.icpTitle')}</p>
            <TextField
              htmlFor="review-icp-name"
              label={t('onboarding.review.icpName')}
              value={icpDraft.name}
              onChange={(value) => setIcpDraft({ ...icpDraft, name: value })}
            />
            <div className="space-y-2">
              <Label htmlFor="review-icp-description">{t('onboarding.review.icpDescription')}</Label>
              <Textarea
                id="review-icp-description"
                rows={2}
                value={icpDraft.description}
                onChange={(e) => setIcpDraft({ ...icpDraft, description: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm font-medium">{t('onboarding.review.goalTitle')}</p>
            <TextField
              htmlFor="review-goal-name"
              label={t('onboarding.review.goalName')}
              value={goalDraft.name}
              onChange={(value) => setGoalDraft({ ...goalDraft, name: value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                htmlFor="review-goal-metric"
                label={t('onboarding.review.goalMetric')}
                value={goalDraft.metric}
                onChange={(value) => setGoalDraft({ ...goalDraft, metric: value })}
              />
              <NumberField
                htmlFor="review-goal-target"
                label={t('onboarding.review.goalTarget')}
                optional
                optionalLabel={t('common.optional')}
                value={goalDraft.targetValue}
                onChange={(value) => setGoalDraft({ ...goalDraft, targetValue: value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="review-goal-deadline">
                  {t('onboarding.review.goalDeadline')}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{t('common.optional')}</span>
                </Label>
                <Input
                  id="review-goal-deadline"
                  type="date"
                  value={goalDraft.deadline}
                  onChange={(e) => setGoalDraft({ ...goalDraft, deadline: e.target.value })}
                />
              </div>
              <SelectField
                htmlFor="review-goal-priority"
                label={t('onboarding.review.goalPriority')}
                optional
                optionalLabel={t('common.optional')}
                value={goalDraft.priority}
                onChange={(value) => setGoalDraft({ ...goalDraft, priority: value as GoalPriority | undefined })}
                options={GOAL_PRIORITIES.map((level) => ({ value: level, labelKey: `enums.priority.${level}` }))}
                translate={t}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {approveError && <p className="mt-4 text-sm text-destructive">{approveError}</p>}

      <div className="mt-6">
        <Button
          disabled={approving || !icpDraft.name.trim() || !goalDraft.name.trim() || !goalDraft.metric.trim()}
          onClick={() => void approveAll()}
        >
          {approving ? t('onboarding.review.approving') : t('onboarding.review.approve')}
        </Button>
      </div>
    </div>
  );
}
