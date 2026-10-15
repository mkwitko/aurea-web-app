import type { GoalStatusEnum2Key } from '@/api/generated/types/GetGoal';

/** The route that performs a move, not the status it lands on. */
export type GoalAction = 'activate' | 'pause' | 'complete' | 'cancel';

export interface GoalMove {
  to: GoalStatusEnum2Key;
  /** Which endpoint performs it — `POST /goals/:id/<action>`. */
  action: GoalAction;
  /** Terminal and irreversible: the transition table has no edge out of it. */
  destructive: boolean;
}

// Sair de CANCELLED não existe na tabela do servidor, então cancelar é
// permanente e ganha confirmação em toda origem.
const CANCEL: GoalMove = { to: 'CANCELLED', action: 'cancel', destructive: true };

/**
 * Espelha a tabela de transições de
 * `back/src/http/api/goals/goals.domain.ts`. Como nos irmãos de experimento e
 * hipótese, o servidor reconfere cada movimento — isto só mantém botão morto
 * fora da tela.
 *
 * Um objetivo não tem exclusão: `Goal` não carrega `deletedAt`, e o ciclo de
 * vida é o status. Desativar é PAUSED (reversível) ou CANCELLED (não).
 */
const MOVES: Record<GoalStatusEnum2Key, GoalMove[]> = {
  DRAFT: [{ to: 'ACTIVE', action: 'activate', destructive: false }, CANCEL],
  ACTIVE: [
    { to: 'PAUSED', action: 'pause', destructive: false },
    { to: 'COMPLETED', action: 'complete', destructive: false },
    CANCEL,
  ],
  PAUSED: [{ to: 'ACTIVE', action: 'activate', destructive: false }, CANCEL],
  COMPLETED: [],
  CANCELLED: [],
};

export function allowedGoalActions(status: GoalStatusEnum2Key): GoalMove[] {
  return MOVES[status];
}
