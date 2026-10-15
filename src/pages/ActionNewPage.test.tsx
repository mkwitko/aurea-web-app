import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { ActionNewPage } from './ActionNewPage';

type Account = {
  id: string;
  platform: string;
  username: string | null;
  pictureUrl: string | null;
  connected: boolean;
};

const ACCOUNTS: Account[] = [
  { id: 'acc-li', platform: 'LINKEDIN', username: null, pictureUrl: null, connected: true },
  { id: 'acc-x', platform: 'X', username: null, pictureUrl: null, connected: true },
];

/**
 * A matriz de capacidade como o backend a devolve.
 *
 * Sem esta rota no stub, `stubFetch` estoura, a query falha calada e a tela vê uma
 * matriz vazia — todo teste sobre "o TikTok exige arquivo" passaria por não haver
 * regra nenhuma. Os valores aqui são os de `PLATFORM_CAPABILITY`.
 */
const CAPABILITIES = [
  { platform: 'LINKEDIN', requiresMedia: false, accepts: ['IMAGE', 'VIDEO'], maxMedia: 4, requiresTitle: false },
  { platform: 'X', requiresMedia: false, accepts: ['IMAGE', 'VIDEO'], maxMedia: 4, requiresTitle: false },
  { platform: 'FACEBOOK', requiresMedia: false, accepts: ['IMAGE', 'VIDEO'], maxMedia: 4, requiresTitle: false },
  { platform: 'THREADS', requiresMedia: false, accepts: ['IMAGE', 'VIDEO'], maxMedia: 4, requiresTitle: false },
  { platform: 'INSTAGRAM', requiresMedia: true, accepts: ['IMAGE', 'VIDEO'], maxMedia: 4, requiresTitle: false },
  { platform: 'TIKTOK', requiresMedia: true, accepts: ['IMAGE', 'VIDEO'], maxMedia: 4, requiresTitle: false },
  { platform: 'YOUTUBE', requiresMedia: true, accepts: ['VIDEO'], maxMedia: 1, requiresTitle: true },
];

const base = (accounts = ACCOUNTS) => ({
  '/integrations/social/accounts': { body: { accounts } },
  '/actions/capabilities': { body: { capabilities: CAPABILITIES } },
  '/experiments': { body: { experiments: [] } },
  '/agent-runs': { body: { runs: [] } },
  // O botão de IA mostra o custo, então a tela lê crédito e preço antes de
  // renderizá-lo.
  '/credits': { body: { balance: 100, franchise: 0, purchased: 100 } },
  '/credits/pricing': { body: { packs: [], operations: [{ taskType: 'propose-social-post', credits: 1 }] } },
});

afterEach(() => vi.unstubAllGlobals());

describe('ActionNewPage', () => {
  it('cria a ação com as redes escolhidas e o texto escrito', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ ...base(), '/actions': { status: 201, body: { action: { id: 'a1' }, targets: [] } } }, calls);

    renderWithProviders(<ActionNewPage />);

    await userEvent.type(await screen.findByLabelText(i18n.t('pages.actions.form.nameLabel')), 'Post sobre custo');
    await userEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
    await userEvent.click(screen.getByRole('button', { name: 'X' }));
    await userEvent.click(screen.getByLabelText(i18n.t('pages.actions.form.contentLabel')));
    await userEvent.paste('Texto do post.');
    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.form.create') }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST' && call.path === '/actions')?.body).toMatchObject({
        type: 'SOCIAL_POST',
        name: 'Post sobre custo',
        payload: { content: 'Texto do post.' },
        platforms: ['LINKEDIN', 'X'],
      }),
    );
  });

  /**
   * A imagem entra no payload só depois de ter subido, e como URL do nosso bucket —
   * é a URL que o backend confere e que a Post for Me vai buscar.
   */
  it('cria a ação com as imagens enviadas', async () => {
    const calls: StubFetchCall[] = [];
    const publicUrl = 'https://cdn.test.aurea/media/ws-1/foto.png';
    stubFetch(
      {
        ...base(),
        '/upload/presigned': { body: { uploadUrl: 'https://r2.test/put/x', publicUrl, key: 'media/ws-1/foto.png' } },
        '/put/x': { body: {} },
        '/actions': { status: 201, body: { action: { id: 'a1' }, targets: [] } },
      },
      calls,
    );

    renderWithProviders(<ActionNewPage />);

    await userEvent.type(await screen.findByLabelText(i18n.t('pages.actions.form.nameLabel')), 'Post com foto');
    await userEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
    await userEvent.click(screen.getByLabelText(i18n.t('pages.actions.form.contentLabel')));
    await userEvent.paste('Texto.');
    await userEvent.upload(
      document.querySelector('input[type="file"]') as HTMLInputElement,
      new File([new Uint8Array(4)], 'foto.png', { type: 'image/png' }),
    );
    await screen.findByRole('button', { name: i18n.t('pages.actions.form.media.remove') });
    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.form.create') }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST' && call.path === '/actions')?.body).toMatchObject({
        payload: { content: 'Texto.', media: [publicUrl] },
      }),
    );
  });

  // Post de texto puro não manda `media: []`: o provider trata ausência e lista
  // vazia de formas diferentes.
  it('não manda media num post sem imagem', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ ...base(), '/actions': { status: 201, body: { action: { id: 'a1' }, targets: [] } } }, calls);

    renderWithProviders(<ActionNewPage />);

    await userEvent.type(await screen.findByLabelText(i18n.t('pages.actions.form.nameLabel')), 'Só texto');
    await userEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));
    await userEvent.click(screen.getByLabelText(i18n.t('pages.actions.form.contentLabel')));
    await userEvent.paste('Texto.');
    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.form.create') }));

    await waitFor(() => expect(calls.some((call) => call.path === '/actions' && call.method === 'POST')).toBe(true));
    const sent = calls.find((call) => call.method === 'POST' && call.path === '/actions')?.body as {
      payload: Record<string, unknown>;
    };
    expect('media' in sent.payload).toBe(false);
  });

  const MEDIA_ACCOUNTS = [
    ...ACCOUNTS,
    { id: 'acc-tt', platform: 'TIKTOK', username: 'acme', pictureUrl: null, connected: true },
    { id: 'acc-yt', platform: 'YOUTUBE', username: 'acme', pictureUrl: null, connected: true },
  ];

  const upload = (publicUrl: string) => ({
    '/upload/presigned': { body: { uploadUrl: 'https://r2.test/put/x', publicUrl, key: 'k' } },
    '/put/x': { body: {} },
  });

  const file = (name: string, type: string) => new File([new Uint8Array(4)], name, { type });
  const pickFile = () => document.querySelector('input[type="file"]') as HTMLInputElement;

  /**
   * A regra que trouxe estas redes, na tela: o TikTok não existe sem arquivo. O
   * botão diz o motivo em vez de ficar cinza sem explicação, e a regra vem da API —
   * não de uma cópia aqui.
   */
  it('só libera as redes que exigem arquivo depois de haver arquivo', async () => {
    const publicUrl = 'https://cdn.test.aurea/media/ws-1/a.png';
    stubFetch({ ...base(MEDIA_ACCOUNTS), ...upload(publicUrl) });

    renderWithProviders(<ActionNewPage />);

    const tiktok = await screen.findByRole('button', {
      name: `TikTok · acme · ${i18n.t('pages.actions.form.platforms.needsMedia')}`,
    });
    expect(tiktok).toBeDisabled();

    await userEvent.upload(pickFile(), file('a.png', 'image/png'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'TikTok · acme' })).toBeEnabled());
  });

  // O YouTube publica vídeo. Imagem ali não é post nenhum, e a tela diz isso antes
  // de alguém aprovar.
  it('não oferece o YouTube para um post com imagem', async () => {
    const publicUrl = 'https://cdn.test.aurea/media/ws-1/a.png';
    stubFetch({ ...base(MEDIA_ACCOUNTS), ...upload(publicUrl) });

    renderWithProviders(<ActionNewPage />);
    await screen.findByRole('button', { name: 'LinkedIn' });
    await userEvent.upload(pickFile(), file('a.png', 'image/png'));

    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: `YouTube · acme · ${i18n.t('pages.actions.form.platforms.noImage')}`,
        }),
      ).toBeDisabled(),
    );
  });

  /**
   * O título só existe por causa do YouTube — o post do provider não tem `title`, e
   * a rede não publica sem ele. Aparece quando o YouTube entra, e bloqueia criar
   * enquanto estiver vazio.
   */
  it('pede o título do vídeo quando o YouTube é destino, e manda no payload', async () => {
    const calls: StubFetchCall[] = [];
    const publicUrl = 'https://cdn.test.aurea/media/ws-1/reel.mp4';
    stubFetch(
      {
        ...base(MEDIA_ACCOUNTS),
        ...upload(publicUrl),
        '/actions': { status: 201, body: { action: { id: 'a1' }, targets: [] } },
      },
      calls,
    );

    renderWithProviders(<ActionNewPage />);

    // Sem YouTube escolhido, o campo não existe: cobrar título de quem publica no X
    // seria campo a mais sem motivo.
    await screen.findByRole('button', { name: 'LinkedIn' });
    expect(screen.queryByLabelText(i18n.t('pages.actions.form.videoTitleLabel'))).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(i18n.t('pages.actions.form.nameLabel')), 'Vídeo novo');
    await userEvent.click(screen.getByLabelText(i18n.t('pages.actions.form.contentLabel')));
    await userEvent.paste('Descrição.');
    await userEvent.upload(pickFile(), file('reel.mp4', 'video/mp4'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'YouTube · acme' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'YouTube · acme' }));

    const titleField = await screen.findByLabelText(i18n.t('pages.actions.form.videoTitleLabel'));
    expect(screen.getByRole('button', { name: i18n.t('pages.actions.form.create') })).toBeDisabled();

    await userEvent.type(titleField, 'Como cortamos 30% do custo');
    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.form.create') }));

    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST' && call.path === '/actions')?.body).toMatchObject({
        payload: { content: 'Descrição.', media: [publicUrl], title: 'Como cortamos 30% do custo' },
        platforms: ['YOUTUBE'],
      }),
    );
  });

  /**
   * Sem rede conectada o formulário não finge: criar responderia AUR-T0046, e
   * deixar o fundador escrever um post inteiro para descobrir isso no fim é
   * desperdiçar o trabalho dele.
   */
  it('sem rede conectada, mostra o caminho para conectar em vez do formulário', async () => {
    stubFetch(base([]));

    renderWithProviders(<ActionNewPage />);

    expect(await screen.findByText(i18n.t('pages.actions.form.needsSocial'))).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t('pages.actions.form.contentLabel'))).not.toBeInTheDocument();
  });

  // Um post sem destino não é rascunho: é linha que nenhuma tela sabe explicar.
  it('não deixa criar sem escolher rede', async () => {
    stubFetch(base());

    renderWithProviders(<ActionNewPage />);

    await userEvent.type(await screen.findByLabelText(i18n.t('pages.actions.form.nameLabel')), 'Post');
    await userEvent.click(screen.getByLabelText(i18n.t('pages.actions.form.contentLabel')));
    await userEvent.paste('Texto.');

    expect(screen.getByRole('button', { name: i18n.t('pages.actions.form.create') })).toBeDisabled();
  });

  it('não deixa criar sem texto', async () => {
    stubFetch(base());

    renderWithProviders(<ActionNewPage />);

    await userEvent.type(await screen.findByLabelText(i18n.t('pages.actions.form.nameLabel')), 'Post');
    await userEvent.click(screen.getByRole('button', { name: 'LinkedIn' }));

    expect(screen.getByRole('button', { name: i18n.t('pages.actions.form.create') })).toBeDisabled();
  });

  /**
   * Conta desconectada aparece, para o fundador saber que existe, e não é
   * selecionável: publicar nela falharia.
   */
  it('mostra desabilitada a conta desconectada', async () => {
    stubFetch(base([{ ...ACCOUNTS[0]!, connected: false }]));

    renderWithProviders(<ActionNewPage />);

    const button = await screen.findByRole('button', {
      name: new RegExp(i18n.t('pages.integrations.social.reconnect')),
    });
    expect(button).toBeDisabled();
  });

  // O agente é o único que fala com IA aqui, e a proposta não cria nada: ela
  // preenche o formulário, e confirmar é humano.
  it('pede a proposta ao agente com as redes conectadas', async () => {
    const calls: StubFetchCall[] = [];
    // Em ordem: a leitura inicial de runs em voo, e só depois a criação. Com um
    // único corpo, o GET receberia a resposta do POST e o hook não teria lista.
    stubFetch(
      {
        ...base(),
        '/agent-runs': [
          { body: { runs: [] } },
          { status: 201, body: { run: { id: 'r1', status: 'RUNNING' } } },
          { body: { runs: [{ id: 'r1', status: 'RUNNING' }] } },
        ],
      },
      calls,
    );

    renderWithProviders(<ActionNewPage />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.actions.form.generate') }));

    await waitFor(() => {
      const run = calls.find((call) => call.method === 'POST' && call.path === '/agent-runs');
      expect(run?.body).toMatchObject({
        taskType: 'propose-social-post',
        input: { connected: ['LINKEDIN', 'X'] },
      });
    });
  });
});
