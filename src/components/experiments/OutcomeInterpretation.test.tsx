import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { OutcomeInterpretation } from './OutcomeInterpretation';

const EXPERIMENT_ID = '11111111-1111-1111-1111-111111111111';
const RUN_ID = '33333333-3333-3333-3333-333333333333';

const OUTPUT = {
  reading: 'Replies reached 18 against a baseline of 4.',
  drivers: ['The list was filtered to recently funded founders.'],
  caveats: ['One month is a short window.'],
  learning: {
    title: 'Funding-round personalization lifts reply rate',
    statement: 'Referencing a recent raise lifted replies above baseline.',
    evidence: ['18 replies on 2026-07-30'],
    confidence: 'MEDIUM',
  },
};

const completedRun = {
  id: RUN_ID,
  taskType: 'interpret-outcome',
  status: 'COMPLETED',
  input: { experimentId: EXPERIMENT_ID },
  output: OUTPUT,
};

function render(canRun = true) {
  return renderWithProviders(<OutcomeInterpretation experimentId={EXPERIMENT_ID} canRun={canRun} />);
}

const renderAdopting = (adoptRunId: string) =>
  renderWithProviders(<OutcomeInterpretation experimentId={EXPERIMENT_ID} canRun adoptRunId={adoptRunId} />);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OutcomeInterpretation', () => {
  it('offers to read the result, naming the credit cost', async () => {
    stubFetch({ '/agent-runs': { body: { runs: [] } }, '/learnings': { body: { learnings: [] } } });

    render();

    expect(await screen.findByRole('button', { name: i18n.t('pages.experiments.interpret.run') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('pages.experiments.interpret.cost', { credits: 2 }))).toBeInTheDocument();
  });

  // Gravar o número já enfileirou a leitura no servidor. Sem adotar esse run, o
  // painel mostraria o botão de rodar e o fundador pagaria de novo por uma
  // leitura que já está na fila.
  it('adota o run que o servidor acabou de enfileirar, em vez de oferecer outro', async () => {
    stubFetch({
      '/agent-runs': { body: { runs: [] } },
      [`/agent-runs/${RUN_ID}`]: { body: { ...completedRun, status: 'RUNNING', output: null } },
      '/learnings': { body: { learnings: [] } },
    });

    renderAdopting(RUN_ID);

    expect(await screen.findByText(i18n.t('pages.experiments.interpret.running'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('pages.experiments.interpret.run') })).not.toBeInTheDocument();
  });

  it('renders the reading, the drivers and the caveats once a run completed', async () => {
    // `useGetAgentRun` polls `/agent-runs/:id` in addition to the recovery
    // query at `/agent-runs` — the brief's fixture only stubbed the latter,
    // which left this poll unstubbed and made `stubFetch` throw. Stubbing the
    // run's own detail route is what `ResearchPanel.test.tsx` does for every
    // fixture that carries a run, and this component follows the same
    // recover → poll shape, so it needs the same route.
    stubFetch({
      '/agent-runs': { body: { runs: [completedRun] } },
      '/agent-runs/33333333-3333-3333-3333-333333333333': { body: completedRun },
      '/learnings': { body: { learnings: [] } },
    });

    render();

    expect(await screen.findByText(OUTPUT.reading)).toBeInTheDocument();
    expect(screen.getByText(OUTPUT.drivers[0]!)).toBeInTheDocument();
    expect(screen.getByText(OUTPUT.caveats[0]!)).toBeInTheDocument();
  });

  it('never characterises the experiment as a success or a failure', async () => {
    stubFetch({
      '/agent-runs': { body: { runs: [completedRun] } },
      '/agent-runs/33333333-3333-3333-3333-333333333333': { body: completedRun },
      '/learnings': { body: { learnings: [] } },
    });

    const { container } = render();
    await screen.findByText(OUTPUT.reading);

    // experiments.md §14: completing must not imply success anywhere in the UI.
    expect(container.textContent).not.toMatch(/\b(succeed|successful|success|failed|failure)\b/i);
  });

  it('accepts the draft through the from-run route, once, and refreshes the learnings list', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/agent-runs': { body: { runs: [completedRun] } },
        '/agent-runs/33333333-3333-3333-3333-333333333333': { body: completedRun },
        '/learnings': { body: { learnings: [] } },
        '/learnings/from-run': { status: 201, body: { learning: { id: 'l1', status: 'CANDIDATE' } } },
      },
      calls,
    );

    render();
    await screen.findByText(OUTPUT.learning.title);

    const learningsGetsBeforeAccept = calls.filter((call) => call.path === '/learnings' && call.method === 'GET').length;

    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.experiments.interpret.accept') }));

    const accepts = calls.filter((call) => call.path === '/learnings/from-run');
    expect(accepts).toHaveLength(1);
    expect(accepts[0]!.body).toEqual({ agentRunId: RUN_ID });

    // LearningsSection invalidates the same query root after its own writes;
    // this asserts accept does too, by checking the list gets re-fetched
    // rather than left showing whatever it held before the accept.
    await vi.waitFor(() => {
      const after = calls.filter((call) => call.path === '/learnings' && call.method === 'GET').length;
      expect(after).toBeGreaterThan(learningsGetsBeforeAccept);
    });
  });

  it('writes nothing when the draft is dismissed', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/agent-runs': { body: { runs: [completedRun] } },
        '/agent-runs/33333333-3333-3333-3333-333333333333': { body: completedRun },
        '/learnings': { body: { learnings: [] } },
      },
      calls,
    );

    render();
    await screen.findByText(OUTPUT.learning.title);
    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.experiments.interpret.dismiss') }));

    expect(screen.queryByText(OUTPUT.learning.title)).not.toBeInTheDocument();
    expect(calls.some((call) => call.method !== 'GET')).toBe(false);
  });

  it('renders the accepted state instead of the button when this run was already accepted', async () => {
    // A reload re-adopts the completed run via recovery. If a Learning citing
    // this run's id already exists (an earlier session's accept), the panel
    // must show the accepted state outright, never offer the button again —
    // clicking it a second time is a 400 from the from-run route.
    stubFetch({
      '/agent-runs': { body: { runs: [completedRun] } },
      '/agent-runs/33333333-3333-3333-3333-333333333333': { body: completedRun },
      '/learnings': { body: { learnings: [{ id: 'l1', status: 'CANDIDATE', sourceAgentRunId: RUN_ID }] } },
    });

    render();
    await screen.findByText(OUTPUT.learning.title);

    expect(await screen.findByText(i18n.t('pages.experiments.interpret.accepted'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('pages.experiments.interpret.accept') })).not.toBeInTheDocument();
  });

  it('says why it cannot run when the experiment is not ready', async () => {
    stubFetch({ '/agent-runs': { body: { runs: [] } }, '/learnings': { body: { learnings: [] } } });

    render(false);

    expect(await screen.findByText(i18n.t('pages.experiments.interpret.notReady'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('pages.experiments.interpret.run') })).not.toBeInTheDocument();
  });

  it('ignores a completed run recovered for a different experiment', async () => {
    // The recovery query has no `experimentId` filter — the generated
    // `/agent-runs` endpoint doesn't support one — so it can return the
    // newest `interpret-outcome` run in the whole workspace, which may belong
    // to a different experiment than the one this panel was mounted for.
    // Rendering that run's reading here would let a founder "Save as a
    // learning" against the wrong `agentRunId` with no indication anything
    // was mismatched.
    const otherExperimentRun = {
      ...completedRun,
      id: '44444444-4444-4444-4444-444444444444',
      input: { experimentId: '22222222-2222-2222-2222-222222222222' },
    };
    stubFetch({
      '/agent-runs': { body: { runs: [otherExperimentRun] } },
      '/agent-runs/44444444-4444-4444-4444-444444444444': { body: otherExperimentRun },
      '/learnings': { body: { learnings: [] } },
    });

    render();

    expect(await screen.findByRole('button', { name: i18n.t('pages.experiments.interpret.run') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('pages.experiments.interpret.cost', { credits: 2 }))).toBeInTheDocument();
    expect(screen.queryByText(OUTPUT.reading)).not.toBeInTheDocument();
    expect(screen.queryByText(OUTPUT.learning.title)).not.toBeInTheDocument();
  });

  it('shows an error and keeps the retry available when a run fails', async () => {
    const failedRun = { ...completedRun, status: 'FAILED', output: null };
    stubFetch({
      '/agent-runs': { body: { runs: [failedRun] } },
      '/agent-runs/33333333-3333-3333-3333-333333333333': { body: failedRun },
      '/learnings': { body: { learnings: [] } },
    });

    render();

    expect(await screen.findByText(i18n.t('pages.experiments.interpret.failed'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('pages.experiments.interpret.run') })).toBeInTheDocument();
  });

  it("shows the run's own error instead of the generic copy, following ResearchPanel", async () => {
    // Credits are charged in the worker, so an insufficient-credits refusal
    // lands in `AgentRun.error`. Throwing it away and showing only the
    // generic "could not read this result" copy tells a founder with no
    // credits to retry forever.
    const failedRun = { ...completedRun, status: 'FAILED', output: null, error: 'Not enough credits for this run.' };
    stubFetch({
      '/agent-runs': { body: { runs: [failedRun] } },
      '/agent-runs/33333333-3333-3333-3333-333333333333': { body: failedRun },
      '/learnings': { body: { learnings: [] } },
    });

    render();

    expect(await screen.findByText('Not enough credits for this run.')).toBeInTheDocument();
    expect(screen.queryByText(i18n.t('pages.experiments.interpret.failed'))).not.toBeInTheDocument();
  });

  it('disables the retry button when the experiment is no longer ready to run', async () => {
    // The retry button in the unreadable branch previously ignored `canRun`
    // while the idle branch honoured it — inconsistent, and it let a retry
    // through the precheck is meant to block.
    const failedRun = { ...completedRun, status: 'FAILED', output: null };
    stubFetch({
      '/agent-runs': { body: { runs: [failedRun] } },
      '/agent-runs/33333333-3333-3333-3333-333333333333': { body: failedRun },
      '/learnings': { body: { learnings: [] } },
    });

    render(false);

    expect(await screen.findByRole('button', { name: i18n.t('pages.experiments.interpret.run') })).toBeDisabled();
  });
});
