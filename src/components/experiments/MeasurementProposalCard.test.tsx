import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { MeasurementProposalCard } from './MeasurementProposalCard';
import { OutcomesSection } from './OutcomesSection';

const EXPERIMENT_ID = '11111111-1111-1111-1111-111111111111';
const proposalPath = `/experiments/${EXPERIMENT_ID}/measurement-proposal`;
const bindingPath = `/experiments/${EXPERIMENT_ID}/metric-binding`;
const outcomesPath = `/experiments/${EXPERIMENT_ID}/outcomes`;

const BINDING = {
  id: 'mb-1',
  experimentId: EXPERIMENT_ID,
  provider: 'GA4',
  config: { metric: 'conversions', dimensionFilter: null },
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
};

const PROPOSAL = {
  value: 42,
  unit: null,
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-07-14T00:00:00.000Z',
  externalRef: 'properties/123456789:conversions',
  query: { metrics: [{ name: 'conversions' }] },
  source: 'GA4',
};

const CREATED = {
  outcome: {
    id: '55555555-5555-5555-5555-555555555555',
    workspaceId: '22222222-2222-2222-2222-222222222222',
    experimentId: EXPERIMENT_ID,
    metric: 'conversions',
    value: 42,
    unit: null,
    observedAt: '2026-07-15T00:00:00.000Z',
    source: 'GA4',
    periodStart: '2026-07-01T00:00:00.000Z',
    periodEnd: '2026-07-14T00:00:00.000Z',
    externalRef: 'properties/123456789:conversions',
    sourceDetail: { metrics: [{ name: 'conversions' }] },
    createdAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-07-15T00:00:00.000Z',
    comparison: { delta: null, deltaPct: null, progressPct: null },
  },
  interpretation: { agentRunId: null, reason: 'Insufficient credits' },
};

afterEach(() => vi.unstubAllGlobals());

describe('MeasurementProposalCard', () => {
  it('mostra o número, o período e a fonte', async () => {
    stubFetch({
      [bindingPath]: { body: { binding: BINDING } },
      [proposalPath]: { body: PROPOSAL },
    });

    renderWithProviders(<MeasurementProposalCard experimentId={EXPERIMENT_ID} canMeasure />);

    expect(await screen.findByText('42')).toBeTruthy();
    expect(screen.getByText(/GA4/)).toBeTruthy();
    expect(screen.getByText(/properties\/123456789:conversions/)).toBeTruthy();
  });

  // A trava do spec §8: confirmar é concordar com a leitura, não transportá-la.
  // O corpo leva `fromSource` e NENHUM valor.
  it('confirma enviando fromSource, sem valor', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        [bindingPath]: { body: { binding: BINDING } },
        [proposalPath]: { body: PROPOSAL },
        [outcomesPath]: { status: 201, body: CREATED },
      },
      calls,
    );

    renderWithProviders(<MeasurementProposalCard experimentId={EXPERIMENT_ID} canMeasure />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.experiments.measurement.confirm') }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST');
      expect(post?.body).toEqual({ fromSource: true });
    });
  });

  // Zero é uma resposta, não uma falha. Confundir os dois é como o tracking
  // quebrado entra no Growth Brain disfarçado de resultado ruim (spec §9).
  it('mostra zero como zero, com a leitura explicada', async () => {
    stubFetch({
      [bindingPath]: { body: { binding: BINDING } },
      [proposalPath]: { body: { ...PROPOSAL, value: 0 } },
    });

    renderWithProviders(<MeasurementProposalCard experimentId={EXPERIMENT_ID} canMeasure />);

    expect(await screen.findByText('0')).toBeTruthy();
    expect(screen.getByText(i18n.t('pages.experiments.measurement.zero'))).toBeTruthy();
    // E ainda dá para confirmar: zero medido é uma medição.
    expect(screen.getByRole('button', { name: i18n.t('pages.experiments.measurement.confirm') })).toBeTruthy();
  });

  it('não busca proposta quando o experimento não tem amarração', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ [bindingPath]: { status: 404, body: { error: { code: 'AUR-T0005' } } } }, calls);

    renderWithProviders(<MeasurementProposalCard experimentId={EXPERIMENT_ID} canMeasure />);

    expect(await screen.findByText(i18n.t('pages.experiments.measurement.noBinding'))).toBeTruthy();
    // Nenhuma chamada à proposta: sem amarração não há o que buscar, e uma
    // requisição que só pode falhar é ruído no lugar de orientação (spec §9).
    await waitFor(() => expect(calls.every((call) => call.path !== proposalPath)).toBe(true));
  });

  // Só o 404 é "ainda não amarrado". Qualquer outra falha da rota de amarração
  // tratada como ausência mandaria o fundador amarrar de novo o que já está
  // amarrado.
  it('uma falha da rota de amarração não é lida como ausência de amarração', async () => {
    stubFetch({
      [bindingPath]: { status: 500, body: { error: { code: 'AUR-T0007', message: 'Something went wrong' } } },
    });

    renderWithProviders(<MeasurementProposalCard experimentId={EXPERIMENT_ID} canMeasure />);

    expect(await screen.findByRole('button', { name: i18n.t('pages.experiments.measurement.retry') })).toBeTruthy();
    expect(screen.queryByText(i18n.t('pages.experiments.measurement.noBinding'))).toBeNull();
  });

  it('mostra a mensagem da própria fonte quando a leitura falha, com retry', async () => {
    stubFetch({
      [bindingPath]: { body: { binding: BINDING } },
      [proposalPath]: {
        status: 502,
        body: {
          error: {
            code: 'AUR-T0039',
            message: 'The source did not return the measurement: Caller does not have permission.',
          },
        },
      },
    });

    renderWithProviders(<MeasurementProposalCard experimentId={EXPERIMENT_ID} canMeasure />);

    expect(await screen.findByText(/Caller does not have permission/)).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('pages.experiments.measurement.retry') })).toBeTruthy();
  });

  // O piso continua de pé: o campo manual fica ao lado da proposta. Este é o
  // teste que impede a automação de virar requisito (spec §11).
  it('conviva com o formulário manual na mesma tela', async () => {
    stubFetch({
      [bindingPath]: { body: { binding: BINDING } },
      [proposalPath]: { body: PROPOSAL },
      [outcomesPath]: { body: { outcomes: [] } },
      '/credits': { body: { allowance: 40, consumed: 0, purchasedBalance: 0 } },
      '/credits/pricing': { body: { operations: [{ taskType: 'interpret-outcome', credits: 2 }] } },
    });

    renderWithProviders(
      <>
        <MeasurementProposalCard experimentId={EXPERIMENT_ID} canMeasure />
        <OutcomesSection experimentId={EXPERIMENT_ID} metric="conversions" targetValue={60} />
      </>,
    );

    expect(await screen.findByRole('button', { name: i18n.t('pages.experiments.measurement.confirm') })).toBeTruthy();
    expect(screen.getByLabelText(new RegExp(i18n.t('pages.experiments.outcomes.valueLabel'), 'i'))).toBeTruthy();
  });

  it('não busca nada enquanto o experimento não está pronto para medir', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ [bindingPath]: { body: { binding: BINDING } } }, calls);

    renderWithProviders(<MeasurementProposalCard experimentId={EXPERIMENT_ID} canMeasure={false} />);

    await waitFor(() => expect(calls.every((call) => call.path !== proposalPath)).toBe(true));
  });
});
