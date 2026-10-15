import { MutationCache, QueryClient } from '@tanstack/react-query';
import { CREDITS } from './modules';

/**
 * Toda mutação que mexe no saldo passa por uma url de agent-run: criar um run
 * debita no `authorizeRun` do backend, cancelar estorna. A `mutationKey` do
 * Kubb é `[{ url }]`, então a url é o que identifica a família.
 */
function touchesCredits(mutationKey: unknown): boolean {
  if (!Array.isArray(mutationKey)) return false;
  const first: unknown = mutationKey[0];
  if (typeof first !== 'object' || first === null || !('url' in first)) return false;
  const url = (first as { url: unknown }).url;
  return typeof url === 'string' && url.startsWith('/agent-runs');
}

/**
 * O chip de saldo no topo da tela ficava parado depois de um run: o número só
 * mudava ao recarregar a página ou ao abrir o faturamento, porque nada
 * invalidava `/credits` quando o crédito era debitado. Um saldo que mente por
 * 30 segundos (o `staleTime`) é pior do que saldo nenhum — o fundador clica em
 * gerar e não vê o preço sair da conta.
 *
 * Fica no `MutationCache` global, e não em cada botão: quatro telas criam runs
 * (`useFillRun`, ResearchPanel, ProposeStrategies, OutcomeInterpretation), e a
 * quinta que alguém escrever amanhã ganha o mesmo comportamento sem precisar
 * lembrar dele. O estorno de um run que FALHA não passa por mutação nenhuma do
 * cliente: quem cobre esse caso é o stream de eventos (`lib/run-events.ts`).
 */
export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, _variables, _context, mutation) => {
      if (!touchesCredits(mutation.options.mutationKey)) return;
      void queryClient.invalidateQueries({ queryKey: CREDITS.queryKeyRoot });
      void queryClient.invalidateQueries({ queryKey: CREDITS.ledgerQueryKeyRoot });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
