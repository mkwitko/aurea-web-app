import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { ActionTargetResolvePanel } from './ActionTargetResolvePanel';

const ACTION_ID = '33333333-3333-3333-3333-333333333333';
const TARGET_ID = '44444444-4444-4444-4444-444444444444';
const url = `/actions/${ACTION_ID}/targets/${TARGET_ID}/resolve`;

const TARGET = {
  id: TARGET_ID,
  platform: 'LINKEDIN',
  lastError: 'socket hang up',
  updatedAt: '2026-08-05T12:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('ActionTargetResolvePanel', () => {
  /**
   * O aviso vem antes dos botões, e nomeia a rede: o fundador tem de olhar a rede
   * dele antes de decidir. Um botão neutro de "tentar de novo" aqui produziria um
   * segundo post público.
   */
  it('avisa para conferir a rede antes de oferecer decisão', () => {
    renderWithProviders(<ActionTargetResolvePanel actionId={ACTION_ID} target={TARGET} onChanged={vi.fn()} />);

    expect(screen.getByText(i18n.t('pages.actions.delivery.checkFirst'))).toBeInTheDocument();
    expect(screen.getByText(/LinkedIn/)).toBeInTheDocument();
    expect(screen.getByText('socket hang up')).toBeInTheDocument();
  });

  it('marca publicado com o id informado', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ [url]: { body: { action: { id: ACTION_ID, status: 'EXECUTED' }, targets: [] } } }, calls);

    renderWithProviders(<ActionTargetResolvePanel actionId={ACTION_ID} target={TARGET} onChanged={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(i18n.t('pages.actions.delivery.externalIdLabel')), 'post_1');
    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.delivery.published') }));

    await waitFor(() =>
      expect(calls.find((call) => call.path === url)?.body).toEqual({ outcome: 'PUBLISHED', externalId: 'post_1' }),
    );
  });

  /**
   * Sem id, a chave não viaja: um `externalId` vazio seria proveniência inventada
   * de um post real, e proveniência ausente é melhor que proveniência de mentira.
   */
  it('não manda id vazio', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ [url]: { body: { action: { id: ACTION_ID, status: 'EXECUTED' }, targets: [] } } }, calls);

    renderWithProviders(<ActionTargetResolvePanel actionId={ACTION_ID} target={TARGET} onChanged={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.delivery.published') }));

    await waitFor(() => expect(calls.find((call) => call.path === url)?.body).toEqual({ outcome: 'PUBLISHED' }));
  });

  it('marca não publicado', async () => {
    const calls: StubFetchCall[] = [];
    stubFetch({ [url]: { body: { action: { id: ACTION_ID, status: 'APPROVED' }, targets: [] } } }, calls);

    renderWithProviders(<ActionTargetResolvePanel actionId={ACTION_ID} target={TARGET} onChanged={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.delivery.notPublished') }));

    await waitFor(() => expect(calls.find((call) => call.path === url)?.body).toEqual({ outcome: 'NOT_PUBLISHED' }));
  });

  // Nenhum botão diz "tentar de novo": a decisão é sobre o que já aconteceu.
  it('não oferece um botão neutro de repetir', () => {
    renderWithProviders(<ActionTargetResolvePanel actionId={ACTION_ID} target={TARGET} onChanged={vi.fn()} />);

    expect(screen.queryByRole('button', { name: i18n.t('pages.actions.detail.retry') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: i18n.t('pages.actions.detail.execute') })).not.toBeInTheDocument();
  });
});
