import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { ActionsPage } from './ActionsPage';

const target = (over: Record<string, unknown> = {}) => ({
  id: 'tgt-1',
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

const ACTION = {
  id: '33333333-3333-3333-3333-333333333333',
  experimentId: null,
  type: 'SOCIAL_POST',
  name: 'Post sobre custo operacional',
  description: null,
  payload: { content: 'Texto do post.' },
  status: 'PENDING_APPROVAL',
  createdBy: 'u1',
  approvedAt: null,
  executedAt: null,
  createdAt: '2026-08-05T10:00:00.000Z',
  updatedAt: '2026-08-05T10:00:00.000Z',
  targets: [target(), target({ id: 'tgt-2', platform: 'X' })],
};

afterEach(() => vi.unstubAllGlobals());

describe('ActionsPage', () => {
  it('lista as ações com estado e as redes do post', async () => {
    stubFetch({ '/actions': { body: { actions: [ACTION] } } });

    renderWithProviders(<ActionsPage />);

    expect(await screen.findByText('Post sobre custo operacional')).toBeInTheDocument();
    // As redes, não um canal só: é o que faz a linha reconhecível numa lista.
    expect(screen.getByText('LinkedIn · X')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('pages.actions.status.PENDING_APPROVAL'))).toBeInTheDocument();
  });

  // A cópia do filtro não pode repetir a do estado: um `getByText` casaria dois
  // nós e o teste quebraria por ambiguidade, não por defeito.
  it('a cópia do filtro não colide com a do estado', () => {
    for (const status of ['PROPOSED', 'APPROVED', 'EXECUTED', 'PARTIALLY_EXECUTED', 'FAILED', 'DELIVERY_UNKNOWN']) {
      expect(i18n.t(`pages.actions.filter.${status}`)).not.toBe(i18n.t(`pages.actions.status.${status}`));
    }
  });

  it('mostra o vazio com o caminho para criar', async () => {
    stubFetch({ '/actions': { body: { actions: [] } } });

    renderWithProviders(<ActionsPage />);

    expect(await screen.findByText(i18n.t('pages.actions.empty'))).toBeInTheDocument();
  });

  it('filtra por estado', async () => {
    stubFetch({ '/actions': { body: { actions: [ACTION] } } });

    renderWithProviders(<ActionsPage />);
    await screen.findByText('Post sobre custo operacional');

    await userEvent.click(screen.getByRole('button', { name: i18n.t('pages.actions.filter.PENDING_APPROVAL') }));

    // O filtro vira query string: a lista é do servidor, não filtrada no cliente
    // — uma lista longa filtrada no cliente esconde o que não veio na página.
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('status=PENDING_APPROVAL'))).toBe(true);
  });

  it('mostra o erro de leitura em vez de uma lista vazia falsa', async () => {
    stubFetch({ '/actions': { status: 500, body: { error: { code: 'AUR-T0007' } } } });

    renderWithProviders(<ActionsPage />);

    expect(await screen.findByText(i18n.t('common.loadError'))).toBeInTheDocument();
  });
});
