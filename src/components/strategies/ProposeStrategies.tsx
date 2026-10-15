import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useListGoals } from '@/api/generated/hooks/goalsHooks/useListGoals';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { useGetCreditPricing } from '@/api/generated/hooks/creditsHooks/useGetCreditPricing';
import { useCreateAgentRun } from '@/api/generated/hooks/agent-runsHooks/useCreateAgentRun';
import { useListAgentRuns } from '@/api/generated/hooks/agent-runsHooks/useListAgentRuns';
import { useGetAgentRun } from '@/api/generated/hooks/agent-runsHooks/useGetAgentRun';
import { useCreateStrategyFromProposal } from '@/api/generated/hooks/strategiesHooks/useCreateStrategyFromProposal';
import { useGetProposalUsage } from '@/api/generated/hooks/strategiesHooks/useGetProposalUsage';
import type { GetAgentRun200StatusEnumKey } from '@/api/generated/types/GetAgentRun';
import { STRATEGIES, HYPOTHESES } from '@/api/modules';
import { availableCredits } from '@/lib/credits';
import { apiErrorMessage } from '@/lib/api-errors';
import { parseProposal, parseRunGoalId } from '@/schemas/strategy-proposal';
import { SpecialistByline } from '@/components/ai/SpecialistByline';
import { Help } from '@/components/Help';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SelectField } from '@/components/form/SelectField';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { StrategyDeck } from '@/components/strategies/StrategyDeck';
import { Loader2 } from 'lucide-react';

const TASK_TYPE = 'propose-strategies';

// Typed against the generated status enum, not `string[]`, so a typo in one
// of these three literals is a compile error rather than a silently-broken
// terminal check.
const TERMINAL: GetAgentRun200StatusEnumKey[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

export function ProposeStrategies() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [goalId, setGoalId] = useState<string>('');
  const [startError, setStartError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const goals = useListGoals();
  const credits = useGetCredits();
  const pricing = useGetCreditPricing();

  const start = useCreateAgentRun({
    mutation: {
      onMutate: () => setStartError(null),
      onError: (error) => setStartError(apiErrorMessage(error, t('pages.strategies.propose.startFailed'))),
      onSuccess: (data) => setRunId(data.id),
    },
  });

  const accept = useCreateStrategyFromProposal({
    mutation: {
      onMutate: () => setAcceptError(null),
      onSuccess: async (data) => {
        // The strategy arrives with its hypotheses already attached, so both
        // caches are stale the moment this response lands — invalidate both
        // before navigating, not just the list the founder is leaving.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: STRATEGIES.queryKeyRoot }),
          queryClient.invalidateQueries({ queryKey: HYPOTHESES.queryKeyRoot }),
          queryClient.invalidateQueries({ queryKey: [{ url: '/strategies/proposal-usage' }] }),
        ]);
        navigate(`/app/strategies/${data.strategy.id}`);
      },
      onError: (error) => setAcceptError(apiErrorMessage(error, t('pages.strategies.propose.acceptFailed'))),
    },
  });

  // Recovery: the newest run for this task is adopted on mount, regardless of
  // status. Filtering to RUNNING would lose the result of a run that finished
  // while the page was reloading — exactly the case that hurts on a phone.
  const latest = useListAgentRuns({ taskType: TASK_TYPE, limit: 1 });
  const recovered = latest.data?.runs[0]?.id ?? null;
  const activeId = runId ?? recovered;

  const run = useGetAgentRun(activeId ?? undefined, {
    query: {
      enabled: activeId !== null,
      // Stops polling once the run is terminal: a fixed interval would keep
      // hitting the server forever after COMPLETED/FAILED/CANCELLED. No cast
      // needed: `useGetAgentRun`'s TQueryData defaults to
      // GetAgentRunQueryResponse, so `query.state.data` is already typed with
      // `status` as the generated enum.
      //
      // `query.state.status === 'error'` also has to stop it: if the poll
      // itself is what is failing (a 500, a deleted run, an expired session),
      // `state.data` never becomes truthy, so checking only `state.data`
      // would keep returning 2000 forever — with `retry: 1` that is roughly
      // a request a second while the founder looks at the error card.
      refetchInterval: (query) =>
        query.state.status === 'error' || (query.state.data && TERMINAL.includes(query.state.data.status))
          ? false
          : 2000,
    },
  });

  // Parsed only once the run is COMPLETED: a PENDING/RUNNING run's `output`
  // is null and must not be run through the schema at all, let alone reported
  // as unreadable. Calculado aqui, antes de qualquer `return` condicional,
  // porque o hook de uso logo abaixo depende dele — hooks não podem ficar
  // depois de um `return` que só dispara em alguns renders.
  const proposal = run.data?.status === 'COMPLETED' ? parseProposal(run.data.output) : null;

  // Buscado só quando existe proposta legível: um run FAILED ou de output
  // inválido não tem opção nenhuma para gastar.
  const usage = useGetProposalUsage(
    { agentRunId: activeId ?? '' },
    { query: { enabled: activeId !== null && proposal?.ok === true } },
  );

  // `!run.isError` matters: if the poll itself fails (network blip, 500), the
  // query never resolves `run.data`, and without this guard the founder would
  // see the "AUREA is thinking" spinner forever instead of a retryable error.
  const waiting = activeId !== null && !run.isError && (!run.data || !TERMINAL.includes(run.data.status));

  // A goal that is paused or completed is not something to strategize about now.
  const actionable = (goals.data?.goals ?? []).filter((goal) => goal.status === 'ACTIVE');
  const chosen = goalId || actionable[0]?.id || '';

  // The run's own goal, resolved by name — never a raw uuid, and never a
  // guess. `run.data.input` is unknown on the wire same as `output`, so it is
  // parsed, not cast. Resolved against every goal the workspace has (not just
  // `actionable`): a goal that has since gone PAUSED or COMPLETED is still
  // the goal that run was about. If the id does not resolve — a still-null
  // input on a PENDING/RUNNING run, a goal deleted since, or a run from
  // before this field existed — `runGoal` stays null and the UI says nothing
  // rather than show an unresolved id.
  const runGoalId = run.data ? parseRunGoalId(run.data.input) : null;
  const runGoal = runGoalId ? (goals.data?.goals ?? []).find((goal) => goal.id === runGoalId) ?? null : null;

  const cost = pricing.data?.operations.find((operation) => operation.taskType === TASK_TYPE)?.credits ?? null;
  const balance = credits.data ? availableCredits(credits.data) : null;
  // Guidance, not authorization: the worker still authorizes the run. Until
  // both the price and the balance have resolved, `short` stays false so an
  // affordable founder is never blocked by a slow network — nor is a run
  // that will fail waved through, since the worker's own check still stands
  // behind this one.
  const short = cost !== null && balance !== null && balance < cost;

  // The run's own state wins over the goal-list state: a founder reloading
  // mid-run (or whose only goal has since gone inactive) must still see their
  // in-flight or failed run, not "no goals" / a load error for a form they
  // are not being shown. These two branches therefore sit above the
  // `goals.isError` / `needGoal` checks below, and depend on no goal data of
  // their own — `runGoal` above resolves from the run's own input, not from
  // `actionable`, so a goal list that failed to load still lets these
  // branches render (just without a name to show).
  if (waiting) {
    return (
      <Card>
        <CardContent className="space-y-1 p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t('pages.strategies.propose.thinking')}
          </div>
          {runGoal && <p className="text-xs text-muted-foreground">{t('pages.strategies.propose.forGoal', { name: runGoal.name })}</p>}
        </CardContent>
      </Card>
    );
  }

  // Covers both a terminal, non-completed run (FAILED/CANCELLED) and the poll
  // itself failing outright (`run.isError`) — either way the founder needs a
  // way out, not an infinite wait.
  if (activeId !== null && (run.isError || (run.data && run.data.status !== 'COMPLETED'))) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-sm text-destructive">{run.data?.error ?? t('pages.strategies.propose.failed')}</p>
          {runGoal && <p className="text-xs text-muted-foreground">{t('pages.strategies.propose.forGoal', { name: runGoal.name })}</p>}
          <Button
            size="sm"
            variant="outline"
            // `Try again` starts a brand-new run rather than clearing `runId`:
            // recovery adopts the newest run regardless of status, so clearing
            // it would just re-adopt this same failed run and the button would
            // appear to do nothing. Fires against `runGoal` — the goal this
            // very run was about, resolved above — never against `chosen`:
            // this screen shows no picker, so falling back to
            // `actionable[0]` would silently start a run about a different
            // goal than the one on screen. Disabled until that goal
            // resolves, rather than guess.
            disabled={start.isPending || !runGoal}
            onClick={() => runGoal && start.mutate({ data: { taskType: TASK_TYPE, input: { goalId: runGoal.id } } })}
          >
            {t('pages.strategies.propose.retryBtn')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // The agent's output failed validation — a malformed run must show a
  // readable message and a way forward, never a half-rendered proposal or a
  // crash from indexing into fields that were never confirmed to exist.
  if (proposal && !proposal.ok) {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-sm text-destructive">{t('pages.strategies.propose.unreadable')}</p>
          {runGoal && <p className="text-xs text-muted-foreground">{t('pages.strategies.propose.forGoal', { name: runGoal.name })}</p>}
          <Button
            size="sm"
            variant="outline"
            // Starts a brand-new run, same as the failed-run branch's retry —
            // `setRunId(null)` would only work in the same session that
            // started this run. A founder who reloaded straight onto an
            // already-malformed run has `runId === null` from the start, so
            // clearing it again would do nothing and the same unreadable card
            // would just re-render. Fires against `runGoal`, same reasoning
            // as the failed-run retry above: no picker on this screen, so
            // `chosen`'s `actionable[0]` fallback would silently target the
            // wrong goal in a multi-goal workspace.
            disabled={start.isPending || !runGoal}
            onClick={() => runGoal && start.mutate({ data: { taskType: TASK_TYPE, input: { goalId: runGoal.id } } })}
          >
            {t('pages.strategies.propose.retryBtn')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (proposal?.ok && activeId) {
    // O uso ainda carregando não pode mostrar o deck: renderizar todas as
    // opções e removê-las depois é oferecer e retirar.
    if (usage.isLoading) return <SectionLoading />;
    // Falhar e mostrar o deck completo seria voltar ao bug que esta query
    // existe para corrigir — o servidor recusaria a adoção duplicada.
    if (usage.isError) return <SectionLoadError refetch={[usage.refetch]} />;

    const used = usage.data?.usedOptionIndexes ?? [];
    const remaining = proposal.value.options.length - used.length;

    if (remaining > 0) {
      return (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {t('pages.strategies.propose.reviewTitle')}
            <Help title={t('pages.strategies.propose.helpTitle')}>{t('pages.strategies.propose.help')}</Help>
          </p>
          {runGoal && <p className="text-xs text-muted-foreground">{t('pages.strategies.propose.forGoal', { name: runGoal.name })}</p>}

          {/* Keyed on the run: a selection carried from one proposal into another
              would adopt this run's option indexes against the other's plans. */}
          <StrategyDeck
            key={activeId}
            runId={activeId}
            proposal={proposal.value}
            usedOptionIndexes={used}
            saving={accept.isPending}
            error={acceptError}
            onAdopt={(optionIndexes, strategy) =>
              accept.mutate({ data: { agentRunId: activeId, optionIndexes, ...(strategy ? { strategy } : {}) } })
            }
          />

          <Button
            size="sm"
            variant="outline"
            // Recovery adopts the newest run regardless of status, so without
            // this the screen would be a dead end once a run is COMPLETED: the
            // proposal branch above returns before the idle form on every later
            // visit, with no way to ask AUREA to propose again. Fires against
            // `runGoal` — the goal this proposal answered, named above — same
            // reasoning as the failed/unreadable retries: no picker is shown
            // here, so `chosen`'s `actionable[0]` fallback would silently pay
            // for a run about whichever goal the picker last defaulted to, not
            // the one the founder is actually looking at.
            disabled={start.isPending || !runGoal}
            onClick={() => runGoal && start.mutate({ data: { taskType: TASK_TYPE, input: { goalId: runGoal.id } } })}
          >
            {t('pages.strategies.propose.startAnotherBtn')}
          </Button>
        </div>
      );
    }
    // Todas gastas: cai fora deste branch e o formulário/botão de nova
    // proposta abaixo assume. Sem isto a tela seria um beco sem saída.
  }

  // Reaching here means `activeId` is null — every branch above returns
  // whenever it isn't. That in turn means both `runId` (this session started
  // no run) and `recovered` are null, and `recovered` is null exactly when
  // `latest` (the recovery query) has no data yet: either it is still in
  // flight, or it failed. Both look identical to "no run exists in this
  // workspace", which is the case the idle form below is for — so before
  // falling into it, that ambiguity has to be resolved first. This sits below
  // every run-state branch above (which must win whenever a run is already
  // known, even mid-recovery-fetch) and above the goals-driven branches below
  // (a broken/loading recovery query is not evidence about goals one way or
  // the other, and must not be read as "no goals" or masked by a goals error).
  if (latest.isLoading) {
    return <SectionLoading />;
  }

  if (latest.isError) {
    // Enabling the idle form here risks a second run: `findActiveByHash`
    // only dedupes an identical goal, so a founder who clicks through this
    // while a run is genuinely in flight for a *different* goal pays for a
    // second one.
    return <SectionLoadError refetch={[latest.refetch]} />;
  }

  // A goal list that failed to load is not "no goals" — rendering the picker
  // over an empty array would offer a form that can never be submitted
  // correctly (no goal to choose, permanently, until a retry). Route it
  // through the shared error card instead.
  if (goals.isError) {
    return <SectionLoadError refetch={[goals.refetch]} />;
  }

  if (goals.isSuccess && actionable.length === 0) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          {t('pages.strategies.propose.needGoal')}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm font-medium">
          {t('pages.strategies.propose.title')}
          <Help title={t('pages.strategies.propose.helpTitle')}>{t('pages.strategies.propose.help')}</Help>
        </p>
        <SpecialistByline specialist="strategist" />

        <SelectField
          htmlFor="propose-goal"
          label={t('pages.strategies.propose.goalLabel')}
          placeholder={t('pages.strategies.propose.goalSelect')}
          value={chosen || undefined}
          onChange={(value) => setGoalId(value ?? '')}
          options={actionable.map((goal) => ({ value: goal.id, labelKey: goal.name }))}
          translate={(label) => label}
        />

        {cost !== null && (
          <p className="text-sm text-muted-foreground">{t('pages.strategies.propose.cost', { credits: cost })}</p>
        )}

        {short && (
          <p className="text-sm text-destructive">
            {t('pages.strategies.propose.short')}{' '}
            <Link to="/app/settings/billing" className="underline">
              {t('pages.strategies.propose.topUp')}
            </Link>
          </p>
        )}

        {startError && <p className="text-sm text-destructive">{startError}</p>}

        <Button
          size="sm"
          // `!chosen` covers the window before `/goals` has resolved (and the
          // impossible-in-practice case of an empty selection slipping through):
          // the button must never be clickably "enabled but inert" — clicking it
          // has to either start a run or be refused, never do nothing silently.
          disabled={short || start.isPending || !chosen}
          onClick={() => start.mutate({ data: { taskType: TASK_TYPE, input: { goalId: chosen } } })}
        >
          {t('pages.strategies.propose.startBtn')}
        </Button>
      </CardContent>
    </Card>
  );
}
