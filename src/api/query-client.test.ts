import { describe, expect, it } from 'vitest';
import { queryClient } from './query-client';
import { CREDITS } from './modules';

const credits = {
  plan: 'GROWTH',
  allowance: 100,
  consumed: 5,
  purchasedBalance: 0,
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-09-01T00:00:00.000Z',
};

/** Roda uma mutação com a mutationKey que o Kubb gera para aquela url. */
async function mutate(url: string) {
  await queryClient
    .getMutationCache()
    .build(queryClient, { mutationKey: [{ url }], mutationFn: async () => ({ id: 'run-1' }) })
    .execute(undefined);
}

describe('queryClient — saldo depois de um run', () => {
  it('marca o saldo e o extrato como velhos quando um run é criado', async () => {
    // O débito acontece no backend, ao autorizar o run. Sem esta invalidação o
    // chip de crédito mostrava o saldo anterior por 30 segundos (staleTime) —
    // ou até a próxima recarga da página, que foi o que o fundador viu.
    queryClient.setQueryData(CREDITS.queryKeyRoot, credits);
    queryClient.setQueryData(CREDITS.ledgerQueryKeyRoot, { entries: [] });

    await mutate('/agent-runs');

    expect(queryClient.getQueryState(CREDITS.queryKeyRoot)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(CREDITS.ledgerQueryKeyRoot)?.isInvalidated).toBe(true);
  });

  it('faz o mesmo no cancelamento, que estorna', async () => {
    queryClient.setQueryData(CREDITS.queryKeyRoot, credits);

    await mutate('/agent-runs/:id/cancel');

    expect(queryClient.getQueryState(CREDITS.queryKeyRoot)?.isInvalidated).toBe(true);
  });

  it('não invalida o saldo por qualquer mutação — só as que mexem nele', async () => {
    queryClient.setQueryData(CREDITS.queryKeyRoot, credits);

    await mutate('/business/context/section');

    expect(queryClient.getQueryState(CREDITS.queryKeyRoot)?.isInvalidated).toBe(false);
  });
});
