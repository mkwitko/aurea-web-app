export const BUSINESS = {
  ENDPOINT: '/business',
  // Atenção: chave de query é casada por igualdade parcial, e `url` é
  // comparada como string inteira — `[{ url: '/business' }]` NÃO invalida
  // `/business/context`. Quem grava contexto tem de invalidar as duas.
  queryKeyRoot: [{ url: '/business' }] as const,
  contextQueryKey: [{ url: '/business/context' }] as const,
  // Sem `params`, casa a presença de qualquer run: um aceite muda o contexto,
  // e o contexto é o que decide o que está guardado em toda pesquisa, não só na
  // que está aberta.
  researchPresenceQueryKey: [{ url: '/business/context/from-research/:agentRunId' }] as const,
} as const;
