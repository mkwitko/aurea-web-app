import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { ActionStatusBadge, ActionTargetStatusBadge } from './ActionStatusBadge';

const ACTION_STATUSES = [
  'PROPOSED',
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTING',
  'EXECUTED',
  'PARTIALLY_EXECUTED',
  'FAILED',
  'CANCELLED',
  'DELIVERY_UNKNOWN',
] as const;

const TARGET_STATUSES = ['PENDING', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'DELIVERY_UNKNOWN'] as const;

describe('ActionStatusBadge', () => {
  it('mostra a cópia do estado', () => {
    renderWithProviders(<ActionStatusBadge status="PENDING_APPROVAL" />);

    expect(screen.getByText(i18n.t('pages.actions.status.PENDING_APPROVAL'))).toBeInTheDocument();
  });

  /**
   * `EXECUTED` passou a poder dizer "publicado", e é a mudança de significado
   * desta fatia: o desfecho vem de leitura autenticada do provider, com o id e a
   * URL do post real. No desenho anterior o que se sabia era só "entregue".
   */
  it('afirma publicação em EXECUTED, porque agora é verdade', () => {
    renderWithProviders(<ActionStatusBadge status="EXECUTED" />);

    expect(screen.getByText(i18n.t('pages.actions.status.EXECUTED'))).toBeInTheDocument();
    // Nos três idiomas, e não só no que a suíte roda: a cópia afirma publicação, e
    // nenhuma delas fala de "entrega" a um intermediário como a anterior falava.
    expect(i18n.getFixedT('pt')('pages.actions.status.EXECUTED')).toBe('Publicado');
    expect(i18n.getFixedT('en')('pages.actions.status.EXECUTED')).toBe('Published');
    expect(i18n.getFixedT('es')('pages.actions.status.EXECUTED')).toBe('Publicado');
  });

  // Nem "publicado" nem "falhou": um post saiu e outro não, e as duas palavras
  // sozinhas mentiriam.
  it('tem cópia própria para publicação parcial', () => {
    renderWithProviders(<ActionStatusBadge status="PARTIALLY_EXECUTED" />);

    const label = i18n.t('pages.actions.status.PARTIALLY_EXECUTED');
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(label).not.toBe(i18n.t('pages.actions.status.EXECUTED'));
    expect(label).not.toBe(i18n.t('pages.actions.status.FAILED'));
  });

  it('tem cópia para os nove estados da ação', () => {
    for (const status of ACTION_STATUSES) {
      const key = `pages.actions.status.${status}`;
      // `t` devolve a própria chave quando ela não existe: é assim que um estado
      // sem cópia aparece na tela como "pages.actions.status.X".
      expect(i18n.t(key)).not.toBe(key);
    }
  });
});

describe('ActionTargetStatusBadge', () => {
  it('usa o vocabulário de entrega, não o de aprovação', () => {
    renderWithProviders(<ActionTargetStatusBadge status="PUBLISHING" />);

    expect(screen.getByText(i18n.t('pages.actions.targetStatus.PUBLISHING'))).toBeInTheDocument();
  });

  it('tem cópia para os cinco estados de um alvo', () => {
    for (const status of TARGET_STATUSES) {
      const key = `pages.actions.targetStatus.${status}`;
      expect(i18n.t(key)).not.toBe(key);
    }
  });
});
