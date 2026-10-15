import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateAgentRun } from '@/api/generated/hooks/agent-runsHooks/useCreateAgentRun';
import { useListAgentRuns } from '@/api/generated/hooks/agent-runsHooks/useListAgentRuns';
import { useGetAgentRun } from '@/api/generated/hooks/agent-runsHooks/useGetAgentRun';
import { useCreateLearningFromRun } from '@/api/generated/hooks/learningsHooks/useCreateLearningFromRun';
import { useListLearnings } from '@/api/generated/hooks/learningsHooks/useListLearnings';
import { LEARNINGS } from '@/api/modules';
import type { GetAgentRun200StatusEnumKey } from '@/api/generated/types/GetAgentRun';
import { apiErrorMessage } from '@/lib/api-errors';
import { interpretOutcomeOutput, parseRunExperimentId } from '@/schemas/interpret-outcome';
import { SpecialistByline } from '@/components/ai/SpecialistByline';
import { Help } from '@/components/Help';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { Loader2 } from 'lucide-react';

const TASK_TYPE = 'interpret-outcome';

// Fixed, not fetched: the agent's price is a constant of this task, not a
// figure that varies by workspace plan the way `research-growth-context`'s
// does elsewhere. Nothing here reads `/credits/pricing`.
const COST = 2;

// Typed against the generated status enum, not `string[]`, so a typo in one of
// these three literals is a compile error rather than a silently-broken
// terminal check. Copied from `ResearchPanel` on purpose: same state machine.
const TERMINAL: GetAgentRun200StatusEnumKey[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

/**
 * AUREA's reading of a completed experiment: what the run → poll → recover
 * shape from `ResearchPanel` looks like applied to a single-shot read instead
 * of a reviewable list. The agent's own output schema has no verdict field —
 * `experiments.md` §14 forbids one — so nothing this component renders can
 * call the experiment a success or a failure; it can only fail to *read* the
 * result, which is shown identically whether the run itself errored or its
 * output failed the schema.
 */
export function OutcomeInterpretation({
  experimentId,
  canRun,
  adoptRunId = null,
}: {
  experimentId: string;
  canRun: boolean;
  /**
   * O run que gravar o número acabou de enfileirar no servidor. Tem precedência
   * sobre a recuperação: é o mais novo por definição, e sem ele o painel
   * ofereceria "rodar" enquanto uma leitura já está na fila — o fundador
   * pagaria duas vezes pela mesma resposta.
   */
  adoptRunId?: string | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const start = useCreateAgentRun({
    mutation: {
      onMutate: () => setStartError(null),
      onError: (error) => setStartError(apiErrorMessage(error, t('pages.experiments.interpret.failed'))),
      onSuccess: (data) => setRunId(data.id),
    },
  });

  const accept = useCreateLearningFromRun({
    mutation: {
      onMutate: () => setAcceptError(null),
      onError: (error) => setAcceptError(apiErrorMessage(error, t('pages.experiments.interpret.failed'))),
      // LearningsSection (mounted directly below this panel) invalidates the
      // same query root after each of its own writes; without this, "Save as
      // a learning" leaves that section showing its empty state and the page
      // banner still asking for a learning that was just recorded.
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: LEARNINGS.queryKeyRoot });
      },
    },
  });

  // Same query LearningsSection makes (`{ experimentId }`), so react-query
  // dedupes the two into one request when both are mounted. Used here only to
  // tell whether THIS run was already accepted — see `alreadyAccepted` below.
  const learnings = useListLearnings({ experimentId });

  // Recovery: the newest run of this task *for this experiment*, adopted
  // regardless of status — a reload mid-run or right after completion still
  // lands on the run's own state rather than a blank form. Unlike
  // `ResearchPanel` (whose goal mismatch is only ever a display concern —
  // "for goal X" — because a founder rarely has two goals mid-research at
  // once), this panel is mounted once per experiment and a mismatch here is
  // not cosmetic: it would let Experiment A's completed reading render under
  // Experiment B's card, with no label to catch it, and "Save as a learning"
  // would then post A's `agentRunId` while the founder believes it is B's.
  // The list endpoint has no `experimentId` filter, so the client fetches a
  // window of the newest runs of this task and picks the first (i.e.
  // newest — the API orders `createdAt desc`) whose own recorded `input`
  // names this experiment, same `AgentRun.input` parse `parseRunGoalId`
  // already does for goals.
  //
  // This window is a client-side approximation, not a real filter: an
  // experiment whose only `interpret-outcome` run falls outside the newest
  // N workspace-wide silently shows as "no run". 50 rather than 20 because
  // `listAgentRunsQuery` caps `limit` at 50 server-side, so this is free
  // headroom, not a new cost. The real fix is a server-side `experimentId`
  // filter on `GET /agent-runs`; accepted as MVP scope until then.
  const latest = useListAgentRuns({ taskType: TASK_TYPE, limit: 50 });
  const recovered =
    latest.data?.runs.find((candidate) => parseRunExperimentId(candidate.input) === experimentId)?.id ?? null;
  const activeId = adoptRunId ?? runId ?? recovered;

  const run = useGetAgentRun(activeId ?? undefined, {
    query: {
      enabled: activeId !== null,
      // Stops polling once the run is terminal, and also when the poll itself
      // is what is failing (`state.status === 'error'`): `state.data` never
      // becomes truthy in that case, so checking only `state.data` would keep
      // retrying every 2s forever behind the error card.
      refetchInterval: (query) =>
        query.state.status === 'error' || (query.state.data && TERMINAL.includes(query.state.data.status))
          ? false
          : 2000,
    },
  });

  // A new run means a new draft: the dismissed flag and any leftover accept
  // state describe the *previous* run's draft, not this one's. Keyed on
  // `activeId` alone — the founder never clicks anything to cause this, so
  // there is one rule instead of a list of triggers the next one won't be on.
  useEffect(() => {
    setDismissed(false);
    accept.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const startRun = () => start.mutate({ data: { taskType: TASK_TYPE, input: { experimentId } } });

  // `!run.isError` matters: if the poll itself fails, `run.data` never
  // resolves, and without this guard the founder would see the spinner
  // forever instead of a retryable error.
  const waiting = activeId !== null && !run.isError && (!run.data || !TERMINAL.includes(run.data.status));

  // Parsed only once the run is COMPLETED: a PENDING/RUNNING run's `output` is
  // null and must never be run through the schema, let alone reported as
  // unreadable while the agent is still working.
  const parsed = run.data?.status === 'COMPLETED' ? interpretOutcomeOutput.safeParse(run.data.output) : null;

  // A run that ended anywhere other than COMPLETED and an output that failed
  // its own schema are shown identically: the founder cannot tell "the agent
  // errored" from "the agent returned nonsense" from here, and does not need
  // to — either way there is no reading, and retrying is the only useful move.
  const unreadable =
    activeId !== null && (run.isError || (run.data && run.data.status !== 'COMPLETED') || (parsed !== null && !parsed.success));

  // A reload re-adopts an already-completed run via recovery, and this run's
  // draft may already have been turned into a Learning in an earlier session
  // — `Learning.sourceAgentRunId` is the record of that. Without this check
  // the founder's first sign of a second accept is a 400 from clicking
  // "Save as a learning" again; with it, the panel shows the accepted state
  // outright and never offers the button.
  const alreadyAccepted =
    activeId !== null && (learnings.data?.learnings.some((learning) => learning.sourceAgentRunId === activeId) ?? false);

  const title = (
    <>
      <p className="text-sm font-medium">
        {t('pages.experiments.interpret.title')}
        <Help title={t('pages.experiments.interpret.help')}>{t('pages.experiments.interpret.helpText')}</Help>
      </p>
      <SpecialistByline specialist="analyst" />
    </>
  );

  let body: ReactNode;

  if (waiting) {
    body = (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {t('pages.experiments.interpret.running')}
      </div>
    );
  } else if (unreadable) {
    body = (
      <div className="space-y-3">
        {/* Prefer the run's own error over the generic copy — credits are
            charged in the worker, so an insufficient-credits refusal lands in
            `run.data.error`, and showing it instead of a blanket "could not
            read this result" is the difference between a founder who
            understands why and one who retries forever. Follows
            ResearchPanel's `run.data?.error ?? t(...)` pattern. */}
        <p className="text-sm text-destructive">{run.data?.error ?? t('pages.experiments.interpret.failed')}</p>
        {/* startError previously only rendered in the idle branch below, so a
            retry refused by the create-run precheck (e.g. insufficient
            credits) showed nothing here and the retry button looked inert. */}
        {startError && <p className="text-sm text-destructive">{startError}</p>}
        {/* The idle branch already only renders once `canRun` is true (see the
            `!canRun` branch further down); this button reaches the same rule
            explicitly, since it sits above that check in the chain. */}
        <Button size="sm" variant="outline" disabled={start.isPending || !canRun} onClick={startRun}>
          {t('pages.experiments.interpret.run')}
        </Button>
      </div>
    );
  } else if (parsed?.success) {
    const output = parsed.data;
    body = (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium">{t('pages.experiments.interpret.reading')}</p>
          <p className="text-sm text-muted-foreground">{output.reading}</p>
        </div>

        <div>
          <p className="text-sm font-medium">{t('pages.experiments.interpret.drivers')}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {output.drivers.map((driver, index) => (
              <li key={index}>{driver}</li>
            ))}
          </ul>
        </div>

        {/* The schema allows an empty list — no caveats is an honest reading,
            not a missing one — so the heading is only shown when there is
            something under it. */}
        {output.caveats.length > 0 && (
          <div>
            <p className="text-sm font-medium">{t('pages.experiments.interpret.caveats')}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {output.caveats.map((caveat, index) => (
                <li key={index}>{caveat}</li>
              ))}
            </ul>
          </div>
        )}

        {!dismissed && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">{t('pages.experiments.interpret.draft')}</p>
            <p className="font-medium">{output.learning.title}</p>
            <p className="text-sm text-muted-foreground">{output.learning.statement}</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {output.learning.evidence.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
            <Badge variant="muted">{t(`enums.confidence.${output.learning.confidence}`)}</Badge>

            {acceptError && <p className="text-sm text-destructive">{acceptError}</p>}

            {/* `accept.isSuccess` covers this session's own click; `alreadyAccepted`
                covers a reload that re-adopted a run whose draft was already
                saved in an earlier session (Learning.sourceAgentRunId). Without
                the second, the founder's first sign of that is a 400 from
                clicking the button again. */}
            {accept.isSuccess || alreadyAccepted ? (
              <p className="text-sm text-muted-foreground">{t('pages.experiments.interpret.accepted')}</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    disabled={accept.isPending}
                    onClick={() => activeId && accept.mutate({ data: { agentRunId: activeId } })}
                  >
                    {accept.isPending && <Loader2 className="size-4 animate-spin" />}
                    {t('pages.experiments.interpret.accept')}
                  </Button>
                  <Button size="sm" variant="outline" disabled={accept.isPending} onClick={() => setDismissed(true)}>
                    {t('pages.experiments.interpret.dismiss')}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t('pages.experiments.interpret.orWrite')}</p>
              </>
            )}
          </div>
        )}
      </div>
    );
  } else if (latest.isLoading) {
    // Reaching here means `activeId` is null: every branch above returns
    // whenever it isn't. `recovered` is null exactly when the recovery query
    // has no data yet — still in flight, or failed — both indistinguishable
    // from "no run exists", which the idle state below is for. That ambiguity
    // has to be resolved before falling into it.
    body = <SectionLoading />;
  } else if (latest.isError) {
    // A founder who saw the idle form here risks paying for a second run:
    // the recovery query is what stands between "read the result" and
    // "read it again for no reason".
    body = <SectionLoadError refetch={[latest.refetch]} />;
  } else if (!canRun) {
    body = <p className="text-sm text-muted-foreground">{t('pages.experiments.interpret.notReady')}</p>;
  } else {
    body = (
      <div className="space-y-3">
        {startError && <p className="text-sm text-destructive">{startError}</p>}
        <Button size="sm" disabled={start.isPending} onClick={startRun}>
          {t('pages.experiments.interpret.run')}
        </Button>
        <p className="text-sm text-muted-foreground">{t('pages.experiments.interpret.cost', { credits: COST })}</p>
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {title}
        {body}
      </CardContent>
    </Card>
  );
}
