import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { PropertyPicker } from './PropertyPicker';

const PROPERTIES = {
  properties: [
    { propertyId: '123456789', displayName: 'Site institucional', accountName: 'Acme Inc' },
    { propertyId: '987654321', displayName: 'App', accountName: 'Acme Inc' },
  ],
  truncated: false,
};

afterEach(() => vi.unstubAllGlobals());

describe('PropertyPicker', () => {
  it('mostra nome da property e da conta, não o id', async () => {
    stubFetch({ '/integrations/google/properties': { body: PROPERTIES } });

    renderWithProviders(<PropertyPicker current={null} />);

    expect(await screen.findByText('Site institucional')).toBeTruthy();
    expect(screen.getAllByText('Acme Inc').length).toBeGreaterThan(0);
  });

  it('manda o propertyId escolhido', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        '/integrations/google/properties': { body: PROPERTIES },
        '/integrations/google/property': { body: { integration: { provider: 'GA4', externalId: '987654321' } } },
      },
      calls,
    );

    renderWithProviders(<PropertyPicker current={null} />);

    await userEvent.click(await screen.findByRole('radio', { name: /App/ }));
    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.integrations.picker.select') }));

    await waitFor(() => {
      const put = calls.find((call) => call.method === 'PUT');
      expect(put?.body).toEqual({ propertyId: '987654321' });
    });
  });

  it('avisa quando a conta não vê property nenhuma', async () => {
    stubFetch({ '/integrations/google/properties': { body: { properties: [], truncated: false } } });

    renderWithProviders(<PropertyPicker current={null} />);

    expect(await screen.findByText(i18n.t('pages.integrations.picker.empty'))).toBeTruthy();
  });

  // Truncar em silêncio faria uma property ausente parecer inexistente.
  it('declara o corte quando a fonte tinha mais de uma página', async () => {
    stubFetch({ '/integrations/google/properties': { body: { ...PROPERTIES, truncated: true } } });

    renderWithProviders(<PropertyPicker current={null} />);

    expect(await screen.findByText(i18n.t('pages.integrations.picker.truncated'))).toBeTruthy();
  });

  it('mostra a mensagem da fonte quando a listagem falha', async () => {
    stubFetch({
      '/integrations/google/properties': {
        status: 400,
        body: { error: { code: 'AUR-T0001', message: 'Caller does not have permission.' } },
      },
    });

    renderWithProviders(<PropertyPicker current={null} />);

    expect(await screen.findByText(/Caller does not have permission/)).toBeTruthy();
  });

  it('marca a property atual quando já existe uma', async () => {
    stubFetch({ '/integrations/google/properties': { body: PROPERTIES } });

    renderWithProviders(<PropertyPicker current="987654321" />);

    const chosen = (await screen.findByRole('radio', { name: /App/ })) as HTMLInputElement;
    expect(chosen.checked).toBe(true);
  });
});
