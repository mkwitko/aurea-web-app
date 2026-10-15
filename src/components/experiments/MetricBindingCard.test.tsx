import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { MetricBindingCard } from './MetricBindingCard';

const EXPERIMENT_ID = '11111111-1111-1111-1111-111111111111';
const RUN_ID = '99999999-9999-9999-9999-999999999999';

const BINDING = {
  id: 'mb-1',
  experimentId: EXPERIMENT_ID,
  provider: 'GA4',
  config: { metric: 'conversions', dimensionFilter: { fieldName: 'eventName', value: 'sign_up' } },
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
};

// The real `GET /credits` shape (`allowance`/`consumed`/`purchasedBalance`),
// not `{ balance, granted, used }`: `availableCredits` in `lib/credits.ts`
// reads those three fields, and a fixture with the wrong names would leave
// `credits.data` truthy but `availableCredits(credits.data)` silently NaN.
const CREDITS = { plan: 'STARTER', allowance: 40, consumed: 0, purchasedBalance: 0, periodStart: '', periodEnd: '' };
const PRICING = { operations: [{ taskType: 'propose-metric-binding', credits: 1 }] };

const bindingPath = `/experiments/${EXPERIMENT_ID}/metric-binding`;

/** O run que a recuperação de `useFillRun` encontra, com a saída do agente. */
const completedRun = (output: unknown) => ({
  id: RUN_ID,
  taskType: 'propose-metric-binding',
  status: 'COMPLETED',
  input: { experimentId: EXPERIMENT_ID },
  output,
  error: null,
  createdAt: '2026-08-04T00:00:00.000Z',
});

afterEach(() => vi.unstubAllGlobals());

describe('MetricBindingCard', () => {
  it('oferece o formulário quando não há amarração', async () => {
    stubFetch({
      [bindingPath]: { status: 404, body: { error: { code: 'AUR-T0005' } } },
      '/credits': { body: CREDITS },
      '/credits/pricing': { body: PRICING },
      '/agent-runs': { body: { runs: [] } },
      '/integrations': { body: { integrations: [{ provider: 'GA4', status: 'OK' }] } },
    });

    renderWithProviders(<MetricBindingCard experimentId={EXPERIMENT_ID} />);

    expect(await screen.findByLabelText(new RegExp(i18n.t('pages.experiments.binding.metricLabel'), 'i'))).toBeTruthy();
    // Preço na tela antes do clique, como em todos os outros botões de IA.
    // `findByText`, e não `getByText`: o campo de métrica é estático e resolve
    // no primeiro render, mas o preço depende de `/credits/pricing` e
    // `/integrations` resolverem — um `getByText` síncrono corre risco de
    // checar antes dessas duas respostas chegarem.
    expect(await screen.findByText(i18n.t('ai.fill.cost', { credits: 1 }))).toBeTruthy();
  });

  it('mostra a amarração existente', async () => {
    stubFetch({
      [bindingPath]: { body: { binding: BINDING } },
      '/credits': { body: CREDITS },
      '/credits/pricing': { body: PRICING },
      '/agent-runs': { body: { runs: [] } },
      '/integrations': { body: { integrations: [{ provider: 'GA4', status: 'OK' }] } },
    });

    renderWithProviders(<MetricBindingCard experimentId={EXPERIMENT_ID} />);

    expect(await screen.findByText('conversions')).toBeTruthy();
    expect(screen.getByText(/eventName/)).toBeTruthy();
  });

  it('preenche os campos com a proposta da IA, e mostra o motivo', async () => {
    stubFetch({
      [bindingPath]: { status: 404, body: { error: { code: 'AUR-T0005' } } },
      '/credits': { body: CREDITS },
      '/credits/pricing': { body: PRICING },
      '/agent-runs': {
        body: {
          runs: [
            completedRun({
              binding: { metric: 'conversions', dimensionFilter: { fieldName: 'eventName', value: 'sign_up' } },
              rationale: 'conversions filtered to sign_up is what this experiment measures.',
            }),
          ],
        },
      },
      [`/agent-runs/${RUN_ID}`]: {
        body: completedRun({
          binding: { metric: 'conversions', dimensionFilter: { fieldName: 'eventName', value: 'sign_up' } },
          rationale: 'conversions filtered to sign_up is what this experiment measures.',
        }),
      },
      '/integrations': { body: { integrations: [{ provider: 'GA4', status: 'OK' }] } },
    });

    renderWithProviders(<MetricBindingCard experimentId={EXPERIMENT_ID} />);

    const metric = (await screen.findByLabelText(
      new RegExp(i18n.t('pages.experiments.binding.metricLabel'), 'i'),
    )) as HTMLInputElement;
    await waitFor(() => expect(metric.value).toBe('conversions'));
    expect(screen.getByText(/is what this experiment measures/)).toBeTruthy();
  });

  // A trava do spec §6: nenhuma métrica plausível devolve vazio com o motivo. A
  // tela não pode preencher nada — uma amarração errada erra todos os números
  // daquele experimento para sempre.
  it('não preenche nada quando o agente diz que nenhuma métrica serve', async () => {
    const output = { binding: null, rationale: 'This property has no metric for booked calls; it lives in your CRM.' };
    stubFetch({
      [bindingPath]: { status: 404, body: { error: { code: 'AUR-T0005' } } },
      '/credits': { body: CREDITS },
      '/credits/pricing': { body: PRICING },
      '/agent-runs': { body: { runs: [completedRun(output)] } },
      [`/agent-runs/${RUN_ID}`]: { body: completedRun(output) },
      '/integrations': { body: { integrations: [{ provider: 'GA4', status: 'OK' }] } },
    });

    renderWithProviders(<MetricBindingCard experimentId={EXPERIMENT_ID} />);

    expect(await screen.findByText(/lives in your CRM/)).toBeTruthy();
    expect(screen.getByText(i18n.t('pages.experiments.binding.aiNothingFits'))).toBeTruthy();
    const metric = screen.getByLabelText(
      new RegExp(i18n.t('pages.experiments.binding.metricLabel'), 'i'),
    ) as HTMLInputElement;
    expect(metric.value).toBe('');
  });

  it('salva com dimensionFilter nulo quando os campos de filtro estão vazios', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        [bindingPath]: [
          { status: 404, body: { error: { code: 'AUR-T0005' } } },
          { body: { binding: BINDING } },
        ],
        '/credits': { body: CREDITS },
        '/credits/pricing': { body: PRICING },
        '/agent-runs': { body: { runs: [] } },
        '/integrations': { body: { integrations: [{ provider: 'GA4', status: 'OK' }] } },
      },
      calls,
    );

    renderWithProviders(<MetricBindingCard experimentId={EXPERIMENT_ID} />);

    await userEvent.type(
      await screen.findByLabelText(new RegExp(i18n.t('pages.experiments.binding.metricLabel'), 'i')),
      'conversions',
    );
    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.experiments.binding.save') }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === 'PUT');
      expect(put?.body).toMatchObject({ provider: 'GA4', config: { metric: 'conversions', dimensionFilter: null } });
    });
  });

  it('pede a conexão da fonte em vez de oferecer a IA quando nada está conectado', async () => {
    stubFetch({
      [bindingPath]: { status: 404, body: { error: { code: 'AUR-T0005' } } },
      '/credits': { body: CREDITS },
      '/credits/pricing': { body: PRICING },
      '/agent-runs': { body: { runs: [] } },
      '/integrations': { body: { integrations: [] } },
    });

    renderWithProviders(<MetricBindingCard experimentId={EXPERIMENT_ID} />);

    expect(await screen.findByText(i18n.t('pages.experiments.binding.notConnected'))).toBeTruthy();
  });
});
