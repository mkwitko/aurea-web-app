import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { SocialSourceCard } from './SocialSourceCard';

const ACCOUNTS = [
  { id: 'acc-li', platform: 'LINKEDIN', username: 'acme', pictureUrl: null, connected: true },
  { id: 'acc-x', platform: 'X', username: 'acme_x', pictureUrl: null, connected: false },
];

const url = '/integrations/social/accounts';

afterEach(() => vi.unstubAllGlobals());

describe('SocialSourceCard', () => {
  it('lista as quatro redes, com a conta de quem já conectou', async () => {
    stubFetch({ [url]: { body: { accounts: ACCOUNTS } } });

    renderWithProviders(<SocialSourceCard />);

    // Espera pelo dado, não pelo rótulo: as quatro redes renderizam antes do
    // fetch, então `findByText('LinkedIn')` resolveria com a lista vazia.
    expect(await screen.findByText('acme')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    // As quatro aparecem, conectadas ou não: o cliente vê o que pode conectar.
    expect(screen.getByText('Facebook')).toBeInTheDocument();
    expect(screen.getByText('Threads')).toBeInTheDocument();
  });

  /**
   * O aviso antes da falha: a autorização daquela conta caiu, e publicar nela
   * falharia. É o que permite reconectar antes de perder um post.
   */
  it('marca a conta desconectada, e oferece reconectar', async () => {
    stubFetch({ [url]: { body: { accounts: ACCOUNTS } } });

    renderWithProviders(<SocialSourceCard />);

    // O rótulo aparece duas vezes na rede desconectada: o badge e o botão.
    await waitFor(() =>
      expect(screen.getAllByText(i18n.t('pages.integrations.social.reconnect')).length).toBeGreaterThan(1),
    );
  });

  it('explica o vazio, e que conectar é um clique', async () => {
    stubFetch({ [url]: { body: { accounts: [] } } });

    renderWithProviders(<SocialSourceCard />);

    expect(await screen.findByText(i18n.t('pages.integrations.social.empty'))).toBeInTheDocument();
  });

  /**
   * Uma URL por rede: o cliente vai direto ao consentimento da plataforma, sem
   * página intermediária de terceiro (spec de migração §2.1).
   */
  it('pede a URL da rede escolhida e abre em nova aba', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        [url]: { body: { accounts: [] } },
        '/integrations/social/connect-url': { status: 201, body: { url: 'https://oauth/linkedin' } },
      },
      calls,
    );
    const open = vi.fn();
    vi.stubGlobal('open', open);

    renderWithProviders(<SocialSourceCard />);

    await screen.findByText(i18n.t('pages.integrations.social.empty'));
    // O primeiro botão "Conectar" é o do LinkedIn, primeira rede da lista.
    const buttons = screen.getAllByRole('button', { name: i18n.t('pages.integrations.social.connectOne') });
    await userEvent.click(buttons[0]!);

    await waitFor(() =>
      expect(calls.find((call) => call.path === '/integrations/social/connect-url')?.body).toEqual({
        platform: 'LINKEDIN',
      }),
    );
    expect(open).toHaveBeenCalledWith('https://oauth/linkedin', '_blank', 'noopener,noreferrer');
  });

  /**
   * O Bluesky não tem OAuth: em vez de abrir aba, a tela pede handle e senha de
   * app. O que se afirma é o caminho inteiro — formulário, envio das credenciais na
   * chamada, e **nenhuma aba aberta**, porque não há consentimento para mostrar.
   */
  it('conecta o Bluesky por formulário, sem abrir aba', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        [url]: { body: { accounts: [] } },
        '/integrations/social/connect-url': {
          status: 201,
          body: { url: 'https://app.postforme.dev/callback/bluesky/account' },
        },
      },
      calls,
    );
    const open = vi.fn();
    vi.stubGlobal('open', open);

    renderWithProviders(<SocialSourceCard />);
    await screen.findByText(i18n.t('pages.integrations.social.empty'));

    // O último "Conectar" é o do Bluesky, última rede da lista.
    const buttons = screen.getAllByRole('button', { name: i18n.t('pages.integrations.social.connectOne') });
    await userEvent.click(buttons[buttons.length - 1]!);

    // Abriu formulário, e não aba.
    await screen.findByText(i18n.t('pages.integrations.social.bluesky.title'));
    expect(open).not.toHaveBeenCalled();

    await userEvent.type(
      screen.getByLabelText(i18n.t('pages.integrations.social.bluesky.handleLabel')),
      'acme.bsky.social',
    );
    const password = screen.getByLabelText(i18n.t('pages.integrations.social.bluesky.passwordLabel'));
    // `type="password"`: a senha é digitada numa tela que pode estar compartilhada.
    expect(password).toHaveAttribute('type', 'password');
    await userEvent.type(password, 'abcd-efgh-ijkl-mnop');

    const submit = screen
      .getAllByRole('button', { name: i18n.t('pages.integrations.social.connectOne') })
      .at(-1)!;
    await userEvent.click(submit);

    await waitFor(() =>
      expect(calls.find((call) => call.path === '/integrations/social/connect-url')?.body).toEqual({
        platform: 'BLUESKY',
        handle: 'acme.bsky.social',
        appPassword: 'abcd-efgh-ijkl-mnop',
      }),
    );
    // Nenhuma aba: a `url` que o provider devolve é uma página dele, não um
    // consentimento — a conta já foi criada do lado deles.
    expect(open).not.toHaveBeenCalled();
  });

  /**
   * Desconectar apaga a autorização do lado do fornecedor: reconectar exige
   * autorizar a rede de novo. Um clique só seria perda silenciosa.
   */
  it('exige confirmação para desconectar, e nomeia a rede', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        [url]: { body: { accounts: [ACCOUNTS[0]] } },
        '/integrations/social/accounts/acc-li/disconnect': { status: 204, body: null },
      },
      calls,
    );

    renderWithProviders(<SocialSourceCard />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.integrations.social.disconnect') }));
    expect(calls.some((call) => call.path.includes('/disconnect'))).toBe(false);

    expect(
      screen.getByText(i18n.t('pages.integrations.social.disconnectTitle', { network: 'LinkedIn' })),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));
    expect(calls.some((call) => call.path.includes('/disconnect'))).toBe(false);
  });

  it('desconecta a conta depois de confirmar', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        [url]: { body: { accounts: [ACCOUNTS[0]] } },
        '/integrations/social/accounts/acc-li/disconnect': { status: 204, body: null },
      },
      calls,
    );

    renderWithProviders(<SocialSourceCard />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.integrations.social.disconnect') }));
    // Dois botões com o mesmo rótulo: o gatilho e a confirmação. O último é o do
    // diálogo.
    const buttons = screen.getAllByRole('button', { name: i18n.t('pages.integrations.social.disconnect') });
    await userEvent.click(buttons[buttons.length - 1]!);

    await waitFor(() =>
      expect(calls.some((call) => call.path === '/integrations/social/accounts/acc-li/disconnect')).toBe(true),
    );
  });

  // Sem conta conectada não há o que desconectar naquela rede.
  it('não oferece desconectar uma rede que não está conectada', async () => {
    stubFetch({ [url]: { body: { accounts: [] } } });

    renderWithProviders(<SocialSourceCard />);

    await screen.findByText(i18n.t('pages.integrations.social.empty'));
    expect(
      screen.queryByRole('button', { name: i18n.t('pages.integrations.social.disconnect') }),
    ).not.toBeInTheDocument();
  });
});
