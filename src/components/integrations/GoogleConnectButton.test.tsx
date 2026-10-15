import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { GoogleConnectButton } from './GoogleConnectButton';

const CONSENT = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=x&state=y';

afterEach(() => vi.unstubAllGlobals());

describe('GoogleConnectButton', () => {
  it('navega para a url que o servidor devolveu', async () => {
    stubFetch({ '/integrations/google/authorize': { body: { url: CONSENT } } });
    // A navegação é stubada: nenhum teste sai do jsdom.
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign, href: 'http://localhost/' });

    renderWithProviders(<GoogleConnectButton label={i18n.t('pages.integrations.google.connect')} />);

    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.integrations.google.connect') }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(CONSENT));
  });

  // O servidor recusa quando o ambiente não tem OAuth. A tela diz isso e aponta
  // o outro caminho, em vez de um botão que só falha.
  it('mostra a mensagem do servidor quando o OAuth não está habilitado', async () => {
    stubFetch({
      '/integrations/google/authorize': {
        status: 400,
        body: { error: { code: 'AUR-T0001', message: 'Connecting with Google is not enabled in this environment' } },
      },
    });
    const onError = vi.fn();

    renderWithProviders(
      <GoogleConnectButton label={i18n.t('pages.integrations.google.connect')} onError={onError} />,
    );

    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.integrations.google.connect') }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.stringMatching(/not enabled/i)));
  });
});
