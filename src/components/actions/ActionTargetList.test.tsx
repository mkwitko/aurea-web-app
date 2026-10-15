import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { ActionTargetList } from './ActionTargetList';

const target = (over: Record<string, unknown> = {}) => ({
  id: 'tgt-1',
  platform: 'LINKEDIN',
  status: 'PENDING',
  externalId: null,
  postUrl: null,
  lastError: null,
  ...over,
});

describe('ActionTargetList', () => {
  it('mostra uma linha por rede, com o estado de cada uma', () => {
    renderWithProviders(
      <ActionTargetList
        targets={[
          target({ status: 'PUBLISHED', externalId: 'post_1', postUrl: 'https://li/1' }),
          target({ id: 'tgt-2', platform: 'X', status: 'FAILED', lastError: 'rate limited' }),
        ]}
      />,
    );

    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText(i18n.t('pages.actions.targetStatus.PUBLISHED'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('pages.actions.targetStatus.FAILED'))).toBeInTheDocument();
  });

  /**
   * A URL vem do provider e é o que torna "publicado" verificável em um clique,
   * em vez de uma palavra nossa.
   */
  it('mostra o post publicado como link para a URL da fonte', () => {
    renderWithProviders(<ActionTargetList targets={[target({ status: 'PUBLISHED', postUrl: 'https://li/1' })]} />);

    const link = screen.getByRole('link', { name: i18n.t('pages.actions.detail.seePost') });
    expect(link).toHaveAttribute('href', 'https://li/1');
  });

  // Sem URL, o id cru: nada é construído por nós.
  it('mostra o id quando o provider não deu URL', () => {
    renderWithProviders(<ActionTargetList targets={[target({ status: 'PUBLISHED', externalId: 'post_1' })]} />);

    expect(screen.getByText('post_1')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  // A mensagem da fonte, literal: "Missing subreddit" diz o que fazer.
  it('mostra a mensagem de erro da fonte', () => {
    renderWithProviders(<ActionTargetList targets={[target({ status: 'FAILED', lastError: 'Missing subreddit' })]} />);

    expect(screen.getByText('Missing subreddit')).toBeInTheDocument();
  });

  /**
   * No alvo incerto a mensagem não vai aqui: quem fala é o painel de resolução,
   * que avisa antes dos botões e nomeia a rede e o horário.
   */
  it('não repete a mensagem no alvo incerto', () => {
    renderWithProviders(
      <ActionTargetList targets={[target({ status: 'DELIVERY_UNKNOWN', lastError: 'socket hang up' })]} />,
    );

    expect(screen.queryByText('socket hang up')).not.toBeInTheDocument();
  });
});
