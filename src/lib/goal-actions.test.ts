import { describe, expect, it } from 'vitest';
import { allowedGoalActions } from './goal-actions';

describe('allowedGoalActions', () => {
  it('offers a draft goal activation and cancellation', () => {
    expect(allowedGoalActions('DRAFT').map((m) => m.action)).toEqual(['activate', 'cancel']);
  });

  it('offers an active goal pause, completion and cancellation', () => {
    // Pausar é o "desativar" reversível; cancelar é o definitivo.
    expect(allowedGoalActions('ACTIVE').map((m) => m.action)).toEqual(['pause', 'complete', 'cancel']);
  });

  it('lets a paused goal come back', () => {
    expect(allowedGoalActions('PAUSED').map((m) => m.action)).toEqual(['activate', 'cancel']);
  });

  it('offers nothing from a terminal status', () => {
    // A tabela do servidor não tem aresta saindo de COMPLETED nem CANCELLED,
    // então um botão aqui só produziria um 400.
    expect(allowedGoalActions('COMPLETED')).toEqual([]);
    expect(allowedGoalActions('CANCELLED')).toEqual([]);
  });

  it('marks cancellation destructive and nothing else', () => {
    // O que decide se a ação pede confirmação — um clique errado é permanente.
    for (const status of ['DRAFT', 'ACTIVE', 'PAUSED'] as const) {
      const destructive = allowedGoalActions(status).filter((m) => m.destructive);
      expect(destructive.map((m) => m.action)).toEqual(['cancel']);
    }
  });
});
