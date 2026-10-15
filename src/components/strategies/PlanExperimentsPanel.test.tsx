import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { PlanExperimentsPanel } from './PlanExperimentsPanel';

afterEach(() => {
  vi.unstubAllGlobals();
});

const STRATEGY_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Hipóteses pendentes de teste — uuids reais, não `h-1`: o schema que lê
 * `run.input` no painel valida `hypothesisId` como uuid, e o servidor nunca
 * manda outra coisa.
 */
const HYPOTHESIS_IDS = [
  '22222222-2222-4222-8222-222222222220',
  '22222222-2222-4222-8222-222222222221',
  '22222222-2222-4222-8222-222222222222',
];

function hypothesesFixture(count: number, overrideId?: string) {
  return Array.from({ length: count }, (_, index) => ({
    id: overrideId ?? HYPOTHESIS_IDS[index]!,
    statement: `Hipótese ${index}`,
    status: 'DRAFT' as const,
  }));
}

function renderPanel(opts: {
  pending?: number;
  pendingHypothesisId?: string;
  credits?: number;
  costPerRun?: number;
  experiments?: Array<Record<string, unknown>>;
  agentRuns?: Array<Record<string, unknown>>;
}) {
  const hypotheses = hypothesesFixture(opts.pending ?? 0, opts.pendingHypothesisId);
  const agentRuns = opts.agentRuns ?? [];
  // Cada run recuperado também é buscado individualmente por
  // `PlanExperimentRun` (polling do `useGetAgentRun`) — sem a rota própria por
  // id, o teste veria "falhou" em vez de "desenhando/criado".
  const runDetailRoutes = Object.fromEntries(
    agentRuns.map((run) => [`/agent-runs/${run.id as string}`, { body: run }]),
  );
  stubFetch({
    '/experiments': { body: { experiments: opts.experiments ?? [] } },
    '/credits': {
      body: {
        plan: 'GROWTH',
        allowance: opts.credits ?? 0,
        consumed: 0,
        purchasedBalance: 0,
        periodStart: '2026-07-01T00:00:00.000Z',
        periodEnd: '2026-08-01T00:00:00.000Z',
      },
    },
    '/credits/pricing': { body: { operations: [{ taskType: 'propose-experiment', credits: opts.costPerRun ?? 2 }] } },
    '/agent-runs': { body: { runs: agentRuns } },
    ...runDetailRoutes,
    // A materialização automática do run concluído: idempotente no servidor,
    // aqui só precisa devolver algo que pareça um experimento criado.
    '/experiments/from-proposal': {
      body: { experiment: { id: 'e-recovered', name: 'Teste recuperado', status: 'DRAFT' } },
    },
  });
  renderWithProviders(<PlanExperimentsPanel strategyId={STRATEGY_ID} hypotheses={hypotheses} />);
}

describe('PlanExperimentsPanel', () => {
  it('mostra o custo total das hipóteses pendentes', async () => {
    // 3 hipóteses pendentes × 2 créditos
    renderPanel({ pending: 3, credits: 100, costPerRun: 2 });

    expect(await screen.findByText(/6/)).toBeInTheDocument();
  });

  it('bloqueia o disparo quando o saldo não cobre o lote', async () => {
    renderPanel({ pending: 3, credits: 4, costPerRun: 2 });

    // Espera o custo total renderizar antes de checar `disabled`: até
    // crédito e preço resolverem, `short` fica falso de propósito (orientação,
    // não autorização), e checar sem esperar pegaria essa janela por sorte.
    expect(await screen.findByText(/6 credits/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled();
  });

  it('não oferece nada quando toda hipótese já tem experimento', async () => {
    renderPanel({ pending: 0, credits: 100, costPerRun: 2 });

    // Espera o painel renderizar (o título é fixo, não depende de nenhuma
    // query) antes de confirmar a ausência — sem isto o teste passaria mesmo
    // se o botão só demorasse a aparecer.
    await screen.findByText('Tests for this plan');
    expect(screen.queryByRole('button', { name: /generate/i })).not.toBeInTheDocument();
  });

  it('lista os campos que faltam num rascunho gerado', async () => {
    renderPanel({
      pending: 0,
      credits: 100,
      costPerRun: 2,
      experiments: [
        {
          id: 'e-1',
          name: 'Teste',
          metric: 'reply_rate',
          baselineValue: null,
          targetValue: null,
          startDate: null,
          endDate: null,
          audience: 'X',
          channel: 'Email',
          successCriteria: 'Y',
        },
      ],
    });

    expect(await screen.findByText(/4/)).toBeInTheDocument();
  });

  it('não trava o botão de gerar quando o run recuperado de uma hipótese pendente falhou', async () => {
    // Um FAILED de hipótese ainda pendente não tem mais nada a esperar: sem
    // este filtro, `recovered` mantinha `tracked` cheio em toda visita futura
    // e o botão "Generate" ficava desabilitado para sempre — sem retry
    // possível, mesmo a mensagem de falha parcial mandando tentar de novo.
    const runId = '33333333-3333-4333-8333-333333333333';
    renderPanel({
      pending: 1,
      pendingHypothesisId: HYPOTHESIS_IDS[0],
      agentRuns: [
        { id: runId, taskType: 'propose-experiment', status: 'FAILED', input: { hypothesisId: HYPOTHESIS_IDS[0] } },
      ],
    });

    const button = await screen.findByRole('button', { name: /generate/i });
    expect(button).not.toBeDisabled();
    // E o card do run falhado não aparece na lista de acompanhamento: ele não
    // está mais em voo nem aguardando virar experimento.
    expect(screen.queryByText(/designing|created/i)).not.toBeInTheDocument();
  });

  it('adota runs de propose-experiment já concluídos de hipóteses pendentes', async () => {
    const runId = '33333333-3333-4333-8333-333333333333';
    renderPanel({
      pending: 1,
      pendingHypothesisId: HYPOTHESIS_IDS[0],
      agentRuns: [
        { id: runId, taskType: 'propose-experiment', status: 'COMPLETED', input: { hypothesisId: HYPOTHESIS_IDS[0] } },
      ],
    });

    // Sem novo disparo: o run já foi pago. `renderWithProviders` fixa o idioma
    // em inglês (convenção dos testes deste repo), então o texto é o de en.json.
    expect(await screen.findByText(/created|designing/i)).toBeInTheDocument();
  });
});
