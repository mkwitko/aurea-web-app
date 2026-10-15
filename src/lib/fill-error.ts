/**
 * O que dizer ao fundador quando um run falha.
 *
 * `AgentRun.error` é texto livre escrito para quem mantém o runner: "tool
 * iteration cap reached (3) without a final answer", "This operation was
 * aborted", "model call budget exhausted (8) without a final answer". A tela
 * mostrava essa string crua — um fundador não-técnico lia jargão em inglês
 * sobre um crédito que acabou de gastar, e nada sobre o que fazer em seguida.
 *
 * O casamento é por padrão de texto, e isso é deliberadamente frágil: a coluna
 * não tem código de erro (só as respostas HTTP têm, no formato AUR-xxxx). Um
 * texto novo cai em `generic`, que continua sendo uma mensagem honesta —
 * nenhum caminho depende de acertar a classe.
 */
export type FillErrorKind = 'tooLong' | 'timeout' | 'credits' | 'refused' | 'generic';

export function fillErrorKind(raw: string | null): FillErrorKind {
  if (!raw) return 'generic';
  const error = raw.toLowerCase();

  // Orçamento do run esgotado: iterações ou chamadas de modelo. A causa quase
  // sempre é resposta grande demais para o teto de saída, e a nova tentativa
  // começa com o teto já crescido.
  if (error.includes('iteration cap') || error.includes('budget exhausted')) return 'tooLong';
  if (error.includes('aborted') || error.includes('timeout') || error.includes('timed out')) return 'timeout';
  if (error.includes('insufficient credits')) return 'credits';
  // Recusa do provider (conteúdo, autenticação, limite de taxa): tentar de novo
  // é legítimo, mas não é falta de espaço nem de tempo.
  if (error.includes('refused') || error.includes('provider') || error.includes('rate limit')) return 'refused';
  return 'generic';
}
