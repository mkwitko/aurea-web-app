import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { ActionDetailPage } from './ActionDetailPage';

const ACTION_ID = '33333333-3333-3333-3333-333333333333';
const TARGET_ID = '44444444-4444-4444-4444-444444444444';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useParams: () => ({ id: ACTION_ID }) };
});

const target = (over: Record<string, unknown> = {}) => ({
  id: TARGET_ID,
  platform: 'LINKEDIN',
  status: 'PENDING',
  externalId: null,
  postUrl: null,
  lastError: null,
  failureKind: null,
  attempts: 0,
  publishedAt: null,
  updatedAt: '2026-08-05T10:00:00.000Z',
  ...over,
});

const action = (over: Record<string, unknown> = {}) => ({
  id: ACTION_ID,
  experimentId: null,
  type: 'SOCIAL_POST',
  name: 'Post sobre custo operacional',
  description: null,
  payload: { content: 'Texto do post.' },
  status: 'PROPOSED',
  createdBy: 'u1',
  approvedAt: null,
  executedAt: null,
  createdAt: '2026-08-05T10:00:00.000Z',
  updatedAt: '2026-08-05T10:00:00.000Z',
  ...over,
});

const detail = (over: Record<string, unknown> = {}, targets: unknown[] = [target()], approvals: unknown[] = []) => ({
  action: action(over),
  targets,
  approvals,
});

const url = `/actions/${ACTION_ID}`;

afterEach(() => vi.unstubAllGlobals());

describe('ActionDetailPage', () => {
  it('mostra o texto, as redes e o estado', async () => {
    stubFetch({ [url]: { body: detail({}, [target(), target({ id: 'tgt-2', platform: 'X' })]) } });

    renderWithProviders(<ActionDetailPage />);

    expect(await screen.findByText('Texto do post.')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('pages.actions.status.PROPOSED'))).toBeInTheDocument();
  });

  /**
   * Quem aprova tem de ver a imagem que sai com o post. Aprovar só o texto é
   * aprovar metade do que vai ao público, e nada desfaz um post publicado.
   */
  it('mostra as imagens do post', async () => {
    const media = ['https://cdn.test.aurea/media/ws-1/a.png', 'https://cdn.test.aurea/media/ws-1/b.png'];
    stubFetch({ [url]: { body: detail({ payload: { content: 'Texto do post.', media } }) } });

    renderWithProviders(<ActionDetailPage />);

    expect(await screen.findByText(i18n.t('pages.actions.detail.media'))).toBeInTheDocument();
    expect(document.querySelectorAll(`img[src="${media[0]}"]`)).toHaveLength(1);
    expect(document.querySelectorAll(`img[src="${media[1]}"]`)).toHaveLength(1);
  });

  // Sem imagem, sem seção: um título "Imagens" sobre o vazio faria o aprovador
  // procurar o que não existe.
  it('não mostra a seção de imagens num post de texto puro', async () => {
    stubFetch({ [url]: { body: detail() } });

    renderWithProviders(<ActionDetailPage />);

    await screen.findByText('Texto do post.');
    expect(screen.queryByText(i18n.t('pages.actions.detail.media'))).not.toBeInTheDocument();
  });

  it('submete um rascunho', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        [url]: [
          { body: detail() },
          { body: detail({ status: 'PENDING_APPROVAL' }) },
          { body: detail({ status: 'PENDING_APPROVAL' }) },
        ],
        [`${url}/submit`]: { body: detail({ status: 'PENDING_APPROVAL' }) },
      },
      calls,
    );

    renderWithProviders(<ActionDetailPage />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.actions.detail.submit') }));

    await waitFor(() => expect(calls.some((call) => call.path === `${url}/submit`)).toBe(true));
  });

  it('aprova o que está aguardando', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        [url]: [
          { body: detail({ status: 'PENDING_APPROVAL' }) },
          { body: detail({ status: 'APPROVED' }) },
          { body: detail({ status: 'APPROVED' }) },
        ],
        [`${url}/approve`]: { body: detail({ status: 'APPROVED' }) },
      },
      calls,
    );

    renderWithProviders(<ActionDetailPage />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.actions.detail.approve') }));

    await waitFor(() => expect(calls.some((call) => call.path === `${url}/approve`)).toBe(true));
  });

  // Aprovar e publicar são atos distintos, e a tela não os junta.
  it('não oferece publicar antes da aprovação', async () => {
    stubFetch({ [url]: { body: detail({ status: 'PENDING_APPROVAL' }) } });

    renderWithProviders(<ActionDetailPage />);

    await screen.findByRole('button', { name: i18n.t('pages.actions.detail.approve') });
    expect(screen.queryByRole('button', { name: i18n.t('pages.actions.detail.execute') })).not.toBeInTheDocument();
  });

  it('publica o que está aprovado, depois de confirmar', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch(
      {
        [url]: [
          { body: detail({ status: 'APPROVED' }) },
          { body: detail({ status: 'EXECUTING' }, [target({ status: 'PUBLISHING' })]) },
          { body: detail({ status: 'EXECUTING' }, [target({ status: 'PUBLISHING' })]) },
        ],
        [`${url}/execute`]: { status: 202, body: detail({ status: 'EXECUTING' }) },
      },
      calls,
    );

    renderWithProviders(<ActionDetailPage />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.actions.detail.execute') }));

    // O diálogo nomeia as redes: publicar no lugar errado é irreversível.
    expect(
      await screen.findByText(i18n.t('pages.actions.detail.confirmExecute.title', { networks: 'LinkedIn' })),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.detail.confirmExecute.confirm') }));

    await waitFor(() => expect(calls.some((call) => call.path === `${url}/execute`)).toBe(true));
  });

  // Publicar é irreversível pela AUREA: só o clique de confirmação publica.
  it('não publica ao abrir o diálogo, nem ao cancelar', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ [url]: { body: detail({ status: 'APPROVED' }) } }, calls);

    renderWithProviders(<ActionDetailPage />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.actions.detail.execute') }));
    expect(calls.some((call) => call.path === `${url}/execute`)).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: i18n.t('common.cancel') }));

    await waitFor(() =>
      expect(
        screen.queryByText(i18n.t('pages.actions.detail.confirmExecute.title', { networks: 'LinkedIn' })),
      ).not.toBeInTheDocument(),
    );
    expect(calls.some((call) => call.path === `${url}/execute`)).toBe(false);
  });

  /**
   * Numa retentativa o diálogo nomeia **só** as redes que ainda não publicaram, e
   * diz que apenas elas serão tentadas — que é exatamente o que o retry do
   * provider faz.
   */
  it('numa publicação parcial, confirma só as redes que faltam', async () => {
    stubFetch({
      [url]: {
        body: detail({ status: 'PARTIALLY_EXECUTED' }, [
          target({ status: 'PUBLISHED', externalId: 'post_1', postUrl: 'https://li/1' }),
          target({ id: 'tgt-2', platform: 'X', status: 'FAILED', lastError: 'rate limited' }),
        ]),
      },
    });

    renderWithProviders(<ActionDetailPage />);

    await userEvent.click(await screen.findByRole('button', { name: i18n.t('pages.actions.detail.retry') }));

    expect(
      screen.getByText(i18n.t('pages.actions.detail.confirmExecute.title', { networks: 'X' })),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('pages.actions.detail.confirmExecute.retryBody'))).toBeInTheDocument();
  });

  it('mostra o post publicado como link para a rede', async () => {
    stubFetch({
      [url]: {
        body: detail({ status: 'EXECUTED', executedAt: '2026-08-05T11:00:00.000Z' }, [
          target({ status: 'PUBLISHED', externalId: 'post_1', postUrl: 'https://li/1', publishedAt: '2026-08-05T11:00:00.000Z' }),
        ]),
      },
    });

    renderWithProviders(<ActionDetailPage />);

    const link = await screen.findByRole('link', { name: i18n.t('pages.actions.detail.seePost') });
    expect(link).toHaveAttribute('href', 'https://li/1');
  });

  // Um alvo incerto ganha painel próprio: a decisão é sobre uma rede, não sobre o
  // post inteiro.
  it('mostra um painel de resolução por alvo incerto', async () => {
    stubFetch({
      [url]: {
        body: detail({ status: 'DELIVERY_UNKNOWN' }, [
          target({ status: 'DELIVERY_UNKNOWN', lastError: 'socket hang up' }),
          target({ id: 'tgt-2', platform: 'X', status: 'PUBLISHED', externalId: 'post_2' }),
        ]),
      },
    });

    renderWithProviders(<ActionDetailPage />);

    expect(await screen.findByText(i18n.t('pages.actions.delivery.checkFirst'))).toBeInTheDocument();
    // Um painel, e não dois: só o alvo incerto ganha decisão; o publicado não.
    expect(screen.getAllByText(i18n.t('pages.actions.delivery.title'))).toHaveLength(1);
  });

  it('mostra a falha com a mensagem da fonte e oferece tentar de novo', async () => {
    stubFetch({
      [url]: {
        body: detail({ status: 'FAILED' }, [
          target({ status: 'FAILED', failureKind: 'VALIDATION', lastError: 'Missing subreddit' }),
        ]),
      },
    });

    renderWithProviders(<ActionDetailPage />);

    expect(await screen.findByText('Missing subreddit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('pages.actions.detail.retry') })).toBeInTheDocument();
  });

  /**
   * A Post for Me não tem endpoint de retry: retentar de um alvo incerto é um
   * segundo envio às cegas, que duplica post público. O backend recusa a
   * transição — `DELIVERY_UNKNOWN` saiu de `EXECUTABLE_FROM` —, e a tela não pode
   * oferecer o que a API nega. A saída é o painel, alvo por alvo.
   */
  it('não oferece publicar nem retentar uma entrega incerta', async () => {
    stubFetch({
      [url]: { body: detail({ status: 'DELIVERY_UNKNOWN' }, [target({ status: 'DELIVERY_UNKNOWN' })]) },
    });

    renderWithProviders(<ActionDetailPage />);

    // O painel é a decisão que existe aqui, e é por ele que se espera o dado.
    await screen.findByText(i18n.t('pages.actions.delivery.checkFirst'));
    expect(screen.queryByRole('button', { name: i18n.t('pages.actions.detail.retry') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('pages.actions.detail.execute') })).not.toBeInTheDocument();
  });

  // Cancelar não existe onde algo pode ter saído para o mundo.
  it('não oferece cancelar uma entrega incerta', async () => {
    stubFetch({
      [url]: { body: detail({ status: 'DELIVERY_UNKNOWN' }, [target({ status: 'DELIVERY_UNKNOWN' })]) },
    });

    renderWithProviders(<ActionDetailPage />);

    await screen.findByText(i18n.t('pages.actions.delivery.checkFirst'));
    expect(screen.queryByRole('button', { name: i18n.t('pages.actions.detail.cancel') })).not.toBeInTheDocument();
  });

  it('mostra o histórico de aprovação com o comentário', async () => {
    stubFetch({
      [url]: {
        body: detail({}, [target()], [
          {
            id: 'ap-1',
            requestedBy: 'u1',
            reviewedBy: 'u2',
            status: 'REJECTED',
            comment: 'Trocar o número.',
            requestedAt: '2026-08-05T10:30:00.000Z',
            reviewedAt: '2026-08-05T10:40:00.000Z',
          },
        ]),
      },
    });

    renderWithProviders(<ActionDetailPage />);

    expect(await screen.findByText('Trocar o número.')).toBeInTheDocument();
  });
});
