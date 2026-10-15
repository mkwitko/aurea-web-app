import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { Ga4SourceCard } from './Ga4SourceCard';

const BASE = {
  id: 'int-1',
  provider: 'GA4',
  authKind: 'OAUTH',
  accountLabel: 'founder@acme.com',
  status: 'OK',
  lastCheckedAt: '2026-08-04T00:00:00.000Z',
  lastError: null,
  createdAt: '2026-08-04T00:00:00.000Z',
};

const WITH_PROPERTY = { ...BASE, externalId: '123456789' };
const WITHOUT_PROPERTY = { ...BASE, externalId: null, status: 'UNVERIFIED' };

const PROPERTIES = {
  properties: [{ propertyId: '123456789', displayName: 'Site institucional', accountName: 'Acme Inc' }],
  truncated: false,
};

afterEach(() => vi.unstubAllGlobals());

describe('Ga4SourceCard', () => {
  it('nada conectado: oferece o Google em destaque e a service account como avançado', async () => {
    stubFetch({ '/integrations': { body: { integrations: [] } } });

    renderWithProviders(<Ga4SourceCard />);

    expect(
      await screen.findByRole('button', { name: i18n.t('pages.integrations.google.connect') }),
    ).toBeTruthy();
    // O formulário técnico existe, e recolhido: pedir JSON de service account a
    // um fundador é pedir que ele vá ao Google Cloud Console.
    expect(screen.getByText(i18n.t('pages.integrations.google.advanced'))).toBeTruthy();
    // O formulário existe no DOM (a `<details>` fechada não remove os filhos),
    // mas `queryByLabelText` não olha visibilidade — quem sabe que ela está
    // recolhida é `toBeVisible`, que entende a relação `<details>`/`<summary>`.
    expect(
      screen.getByLabelText(new RegExp(i18n.t('pages.integrations.credentialsLabel').replace(/[()]/g, '\\$&'), 'i')),
    ).not.toBeVisible();
  });

  it('conectado sem property: mostra o picker e diz que não dá para medir ainda', async () => {
    stubFetch({
      '/integrations': { body: { integrations: [WITHOUT_PROPERTY] } },
      '/integrations/google/properties': { body: PROPERTIES },
    });

    renderWithProviders(<Ga4SourceCard />);

    expect(await screen.findByText(i18n.t('pages.integrations.picker.noneChosen'))).toBeTruthy();
    expect(await screen.findByText('Site institucional')).toBeTruthy();
  });

  it('conectado com property: mostra conta, property e status, e nunca o segredo', async () => {
    stubFetch({ '/integrations': { body: { integrations: [WITH_PROPERTY] } } });

    const { container } = renderWithProviders(<Ga4SourceCard />);

    expect(await screen.findByText('founder@acme.com')).toBeTruthy();
    expect(screen.getByText('123456789')).toBeTruthy();
    expect(screen.getByText(i18n.t('pages.integrations.status.OK'))).toBeTruthy();
    expect(container.textContent).not.toContain('refresh_token');
    expect(container.textContent).not.toContain('private_key');
  });

  // Migrado de Ga4ConnectionCard.test.tsx ("mostra a mensagem da própria fonte
  // quando a última verificação falhou"): o `lastError` da fonte é a mensagem
  // mais útil que existe quando algo quebra, e continua tendo de aparecer no
  // estado "conectado com property".
  it('mostra a mensagem da própria fonte quando a última verificação falhou', async () => {
    stubFetch({
      '/integrations': {
        body: { integrations: [{ ...WITH_PROPERTY, status: 'FAILED', lastError: 'Caller does not have permission.' }] },
      },
    });

    renderWithProviders(<Ga4SourceCard />);

    expect(await screen.findByText(/Caller does not have permission/i)).toBeTruthy();
  });

  it('trocar property reabre o picker', async () => {
    stubFetch({
      '/integrations': { body: { integrations: [WITH_PROPERTY] } },
      '/integrations/google/properties': { body: PROPERTIES },
    });

    renderWithProviders(<Ga4SourceCard />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.integrations.picker.change') }));

    expect(await screen.findByText(i18n.t('pages.integrations.picker.title'))).toBeTruthy();
  });

  // Substituir é destrutivo, e o @@unique garante que é substituição e não
  // adição. Essa é a informação que falta na tela.
  it('pede confirmação antes de substituir uma conexão existente', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/integrations': { body: { integrations: [WITH_PROPERTY] } },
        '/integrations/google/authorize': { body: { url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' } },
      },
      calls,
    );

    renderWithProviders(<Ga4SourceCard />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.integrations.google.connect') }));

    expect(await screen.findByText(i18n.t('pages.integrations.replace.body'))).toBeTruthy();
    // Nada foi pedido ao servidor até o humano confirmar.
    expect(calls.every((call) => call.path !== '/integrations/google/authorize')).toBe(true);
  });

  it('desconecta', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/integrations': [
          { body: { integrations: [WITH_PROPERTY] } },
          { status: 204, body: {} },
          { body: { integrations: [] } },
        ],
      },
      calls,
    );

    renderWithProviders(<Ga4SourceCard />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.integrations.disconnect') }));

    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE')).toBe(true));
  });

  it('mostra o banner de retorno do Google e limpa o parâmetro', async () => {
    stubFetch({
      '/integrations': { body: { integrations: [WITHOUT_PROPERTY] } },
      '/integrations/google/properties': { body: PROPERTIES },
    });
    const replaceState = vi.spyOn(window.history, 'replaceState');
    window.history.replaceState({}, '', '/app/settings/integrations?google=connected');

    renderWithProviders(<Ga4SourceCard />);

    expect(await screen.findByText(i18n.t('pages.integrations.google.connectedBanner'))).toBeTruthy();
    // Limpo depois: um F5 não ressuscita a mensagem.
    await waitFor(() => expect(replaceState).toHaveBeenCalled());
    expect(window.location.search).not.toContain('google=connected');
  });

  it('traduz o motivo do erro que o Google devolveu', async () => {
    stubFetch({ '/integrations': { body: { integrations: [] } } });
    window.history.replaceState({}, '', '/app/settings/integrations?google=error&reason=access_denied');

    renderWithProviders(<Ga4SourceCard />);

    expect(await screen.findByText(i18n.t('pages.integrations.google.reason.access_denied'))).toBeTruthy();
  });
});
