import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useListGoals } from '@/api/generated/hooks/goalsHooks/useListGoals';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { useGetCreditPricing } from '@/api/generated/hooks/creditsHooks/useGetCreditPricing';
import { useCreateAgentRun } from '@/api/generated/hooks/agent-runsHooks/useCreateAgentRun';
import { useListAgentRuns } from '@/api/generated/hooks/agent-runsHooks/useListAgentRuns';
import { useGetAgentRun } from '@/api/generated/hooks/agent-runsHooks/useGetAgentRun';
import type { GetAgentRun200StatusEnumKey } from '@/api/generated/types/GetAgentRun';
import { AGENT_RUNS } from '@/api/modules';
import { availableCredits } from '@/lib/credits';
import { apiErrorMessage } from '@/lib/api-errors';
import { parseResearch } from '@/schemas/research-findings';
import { parseRunGoalId } from '@/schemas/strategy-proposal';
import { SpecialistByline } from '@/components/ai/SpecialistByline';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SelectField } from '@/components/form/SelectField';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { ResearchDeck } from '@/components/research/ResearchDeck';
import { ResearchRunTabs } from '@/components/research/ResearchRunTabs';
import { Loader2 } from 'lucide-react';

const TASK_TYPE = 'research-growth-context';

// Typed against the generated status enum, not `string[]`, so a typo in one of
// these three literals is a compile error rather than a silently-broken
// terminal check.
const TERMINAL: GetAgentRun200StatusEnumKey[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

// Quantas pesquisas ficam alcançáveis pelas abas. Um teto existe porque a lista
// é paga em requisição, não em créditos, e ninguém revisa vinte pesquisas de uma
// vez; as mais novas são as que importam.
const RUN_LIMIT = 10;

/**
 * The Research Agent's run-and-review screen: start runs against goals, watch
 * them, and review each result with `ResearchDeck`, which is where the founder
 * judges it card by card.
 *
 * Several researches can be in flight at once, one per goal — the backend keys
 * concurrency per task and input, so two goals never block each other, and this
 * screen no longer pretends otherwise. The run tabs are always on top, so a
 * research that is still thinking is never a wall in front of the others: the
 * founder starts one for another goal and comes back to it later.
 *
 * This component owns the runs and nothing about a review: what is already in
 * the business context is the server's answer, asked for inside the deck, so it
 * is a fact about the workspace rather than a memory of this tab.
 */
export function ResearchPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [goalId, setGoalId] = useState<string>('');
  const [startError, setStartError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // The picker is a place the founder can be, not the absence of a run: with
  // several researches open, "start another one" cannot mean "forget the ones
  // that exist" the way dismissing recovery used to.
  const [picking, setPicking] = useState(false);

  const goals = useListGoals();
  const credits = useGetCredits();
  const pricing = useGetCreditPricing();

  const start = useCreateAgentRun({
    mutation: {
      onMutate: () => setStartError(null),
      onError: (error) => setStartError(apiErrorMessage(error, t('pages.research.startFailed'))),
      onSuccess: async (data) => {
        setSelectedId(data.id);
        setPicking(false);
        // Sem isto a nova pesquisa não aparece entre as abas até o próximo
        // refetch, e as outras em voo desapareceriam da vista de quem acabou de
        // abrir mais uma.
        await queryClient.invalidateQueries({ queryKey: AGENT_RUNS.queryKeyRoot });
      },
    },
  });

  // Todas as pesquisas recentes, não só a mais nova. Sem filtro de status:
  // filtrar por RUNNING perderia o resultado de um run que terminou enquanto a
  // página recarregava — justamente o caso que dói no celular.
  const latest = useListAgentRuns(
    { taskType: TASK_TYPE, limit: RUN_LIMIT },
    {
      query: {
        // Enquanto alguma pesquisa não terminou, a lista é o que anuncia que ela
        // ficou pronta — inclusive a que não está aberta. Terminadas todas, para
        // de perguntar.
        refetchInterval: (query) =>
          query.state.data?.runs.some((run) => !TERMINAL.includes(run.status)) ? 30000 : false,
      },
    },
  );

  const runs = latest.data?.runs ?? [];
  // A mais nova é a resposta certa na chegada: é a pesquisa que o fundador
  // acabou de pedir, ou a que terminou enquanto ele estava fora.
  const activeId = picking ? null : selectedId ?? runs[0]?.id ?? null;

  const run = useGetAgentRun(activeId ?? undefined, {
    query: {
      enabled: activeId !== null,
      // Stops polling once the run is terminal: a fixed interval would keep
      // hitting the server forever after COMPLETED/FAILED/CANCELLED.
      //
      // `query.state.status === 'error'` also has to stop it: if the poll
      // itself is what is failing (a 500, a deleted run, an expired session),
      // `state.data` never becomes truthy, so checking only `state.data` would
      // keep returning 30000 forever — a request every 30s while the founder
      // looks at an error card. The SSE stream (`useAgentRunEvents`) is what
      // makes 30s tolerable instead of the old 2s: it is latency, this is the
      // floor.
      refetchInterval: (query) =>
        query.state.status === 'error' || (query.state.data && TERMINAL.includes(query.state.data.status))
          ? false
          : 30000,
    },
  });

  // `!run.isError` matters: if the poll itself fails, the query never resolves
  // `run.data`, and without this guard the founder would see the spinner
  // forever instead of a retryable error.
  const waiting = activeId !== null && !run.isError && (!run.data || !TERMINAL.includes(run.data.status));

  // A goal that is paused or completed is not something to research about now.
  const actionable = (goals.data?.goals ?? []).filter((goal) => goal.status === 'ACTIVE');
  const chosen = goalId || actionable[0]?.id || '';

  // The run's own goal, resolved by name — never a raw uuid, and never a guess.
  // `run.data.input` is unknown on the wire same as `output`, so it is parsed,
  // not cast. Resolved against every goal the workspace has (not just
  // `actionable`): a goal that has since gone PAUSED or COMPLETED is still the
  // goal that run was about. If the id does not resolve — a still-null input on
  // a PENDING run, or a goal deleted since — `runGoal` stays null and the UI
  // says nothing rather than show an unresolved id.
  const runGoalId = run.data ? parseRunGoalId(run.data.input) : null;
  const runGoal = runGoalId ? (goals.data?.goals ?? []).find((goal) => goal.id === runGoalId) ?? null : null;

  const cost = pricing.data?.operations.find((operation) => operation.taskType === TASK_TYPE)?.credits ?? null;
  const balance = credits.data ? availableCredits(credits.data) : null;
  // Guidance, not authorization: the worker still authorizes the run. Until
  // both the price and the balance have resolved, `short` stays false so an
  // affordable founder is never blocked by a slow network.
  const short = cost !== null && balance !== null && balance < cost;

  const againForThisGoal = (labelKey: string) => (
    <Button
      size="sm"
      variant="outline"
      // Fires against `runGoal` — the goal this very run was about — never
      // against `chosen`: this branch shows no picker, so falling back to
      // `actionable[0]` would silently pay for a run about a different goal than
      // the one on screen. Disabled until that goal resolves, rather than guess.
      disabled={start.isPending || !runGoal}
      onClick={() => runGoal && start.mutate({ data: { taskType: TASK_TYPE, input: { goalId: runGoal.id } } })}
    >
      {t(labelKey)}
    </Button>
  );

  const forGoal = runGoal ? (
    <p className="text-xs text-muted-foreground">{t('pages.research.forGoal', { name: runGoal.name })}</p>
  ) : null;

  const body = () => {
    // The run's own state wins over the goal-list state: a founder reloading
    // mid-run (or whose only goal has since gone inactive) must still see their
    // in-flight or failed run, not "no goals" / a load error for a form they are
    // not being shown. These branches therefore sit above the `goals.isError` /
    // `needGoal` checks below, and depend on no goal data of their own.
    if (waiting) {
      return (
        <Card>
          <CardContent className="space-y-1 p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t('pages.research.thinking')}
            </div>
            {forGoal}
            {/* Esperar não é mais um beco: as abas acima seguem clicáveis, e
                esta linha diz que é isso mesmo — o fundador pode abrir outra
                pesquisa enquanto esta pensa. */}
            <p className="text-xs text-muted-foreground">{t('pages.research.meanwhile')}</p>
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
            <p className="text-sm text-destructive">{run.data?.error ?? t('pages.research.failed')}</p>
            {forGoal}
            <div className="flex flex-wrap items-center gap-2">{againForThisGoal('pages.research.retryBtn')}</div>
          </CardContent>
        </Card>
      );
    }

    // Parsed only once the run is COMPLETED: a PENDING/RUNNING run's `output` is
    // null and must not be run through the schema at all, let alone reported as
    // unreadable.
    const research = run.data?.status === 'COMPLETED' ? parseResearch(run.data.output) : null;

    // The agent's output failed validation — a malformed run must show a readable
    // message and a way forward, never a half-rendered result or a crash from
    // indexing into fields that were never confirmed to exist.
    if (research && !research.ok) {
      return (
        <Card>
          <CardContent className="space-y-3 p-5">
            <p className="text-sm text-destructive">{t('pages.research.unreadable')}</p>
            {forGoal}
            <div className="flex flex-wrap items-center gap-2">{againForThisGoal('pages.research.retryBtn')}</div>
          </CardContent>
        </Card>
      );
    }

    if (research?.ok && activeId) {
      const { summary, findings, opportunities } = research.value;

      return (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('pages.research.reviewTitle')}</p>
            {forGoal}
          </div>

          <Card>
            <CardContent className="space-y-1 p-5">
              <p className="text-sm font-medium">{t('pages.research.summaryLabel')}</p>
              <p className="text-sm text-muted-foreground">{summary}</p>
            </CardContent>
          </Card>

          {/* Keyed on the run: a review carried from one run into another would
              post this run's card positions against the other run's indexes. */}
          <ResearchDeck key={activeId} runId={activeId} findings={findings} opportunities={opportunities} />

          <div className="flex flex-wrap items-center gap-2">
            {againForThisGoal('pages.research.startAnotherBtn')}
          </div>
        </div>
      );
    }

    // Reaching here means `activeId` is null — every branch above returns
    // whenever it isn't. Either the founder asked for the picker, or the list
    // has no run to select: still in flight, or failed. The last two look
    // identical to "no research exists in this workspace", which is what the
    // idle form below is for — so that ambiguity has to be resolved first.
    if (!picking && latest.isLoading) {
      return <SectionLoading />;
    }

    if (!picking && latest.isError) {
      // Enabling the idle form here risks a second run: the server only dedupes
      // an identical goal, so a founder who clicks through this while a run is
      // genuinely in flight for a *different* goal pays for a second one.
      return <SectionLoadError refetch={[latest.refetch]} />;
    }

    // A goal list that failed to load is not "no goals" — rendering the picker
    // over an empty array would offer a form that can never be submitted
    // correctly. Route it through the shared error card instead.
    if (goals.isError) {
      return <SectionLoadError refetch={[goals.refetch]} />;
    }

    if (goals.isSuccess && actionable.length === 0) {
      return (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground">{t('pages.research.needGoal')}</CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent className="space-y-4 p-5">
          {/* Sem repetir título nem ajuda: `ResearchPage` já os mostra no
              cabeçalho, e o mesmo texto duas vezes na mesma tela é parte do que
              fazia esta página parecer confusa. */}
          <SpecialistByline specialist="researcher" />

          <SelectField
            htmlFor="research-goal"
            label={t('pages.research.goalLabel')}
            placeholder={t('pages.research.goalSelect')}
            value={chosen || undefined}
            onChange={(value) => setGoalId(value ?? '')}
            options={actionable.map((goal) => ({ value: goal.id, labelKey: goal.name }))}
            translate={(label) => label}
          />

          {cost !== null && (
            <p className="text-sm text-muted-foreground">{t('pages.research.cost', { credits: cost })}</p>
          )}

          {short && (
            <p className="text-sm text-destructive">
              {t('pages.research.short')}{' '}
              <Link to="/app/settings/billing" className="underline">
                {t('pages.research.topUp')}
              </Link>
            </p>
          )}

          {startError && <p className="text-sm text-destructive">{startError}</p>}

          <Button
            size="sm"
            // `!chosen` covers the window before `/goals` has resolved: the button
            // must never be clickably "enabled but inert" — clicking it has to
            // either start a run or be refused, never do nothing silently.
            disabled={short || start.isPending || !chosen}
            onClick={() => start.mutate({ data: { taskType: TASK_TYPE, input: { goalId: chosen } } })}
          >
            {t('pages.research.startBtn')}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Sempre acima do corpo, inclusive enquanto uma pesquisa roda: é o que
          torna "várias pesquisas ao mesmo tempo" verdade na tela e não só no
          servidor. Escondido quando não há nenhuma — um seletor de uma coisa
          nenhuma é ruído. */}
      {runs.length > 0 && (
        <ResearchRunTabs
          runs={runs}
          goals={goals.data?.goals ?? []}
          selectedId={activeId}
          onSelect={(id) => {
            setSelectedId(id);
            setPicking(false);
          }}
          onNew={() => setPicking(true)}
          picking={picking}
        />
      )}
      {body()}
    </div>
  );
}
