/**
 * Os destinos legais de uma pergunta, por entidade.
 *
 * Espelham os enums `fills` do backend — `CONTEXT_FILLS` em
 * `back/src/ai/agents/fill/context-sections.ts` e as constantes `FILLS` de
 * cada agente em `back/src/ai/agents/fill/`. Os dois repositórios não
 * compartilham código, então isto é uma cópia deliberada: o backend recusa no
 * schema do run, e o cliente recusa de novo aqui porque é ele quem chama
 * setValue com essa string.
 *
 * Um caminho aqui é o caminho DENTRO do formulário daquela tela.
 */
export const CONTEXT_FILL_PATHS = [
  'marketContext.sam',
  'marketContext.som',
  'constraints.monthlyGrowthBudget',
  'constraints.teamSize',
  'constraints.growthTeamSize',
  'constraints.urgency',
  'currentPerformance.mrr',
  'currentPerformance.totalCustomers',
  'currentPerformance.activeCustomers',
  'currentPerformance.churnRate',
  'currentPerformance.monthlySignups',
  'currentPerformance.conversionRate',
  'currentPerformance.timeToConvert',
  'currentPerformance.baselineDate',
  'currentActivities.contentProduction.blogPostsPerMonth',
  'currentActivities.contentProduction.socialPostsPerWeek',
  'currentActivities.contentProduction.emailCampaignsPerMonth',
  'currentActivities.paidAdvertising.monthlySpend',
] as const;

export const GOAL_FILL_PATHS = ['targetValue', 'deadline'] as const;

export const EXPERIMENT_FILL_PATHS = ['baselineValue', 'targetValue', 'startDate', 'endDate'] as const;

/**
 * Para os agentes cujos campos são todos pesquisáveis — perfil da empresa,
 * ICP, hipótese. Eles não perguntam nada, e uma pergunta vinda deles é
 * resultado malformado, não uma pergunta a mais.
 */
export const NO_FILL_PATHS: readonly string[] = [];

/**
 * O tipo de resposta que cada destino aceita, decidido pelo formulário e não
 * pelo modelo.
 *
 * Espelha `CONTEXT_FILL_ANSWER_TYPES` de
 * `back/src/ai/agents/fill/context-sections.ts`, que hoje recusa no schema do
 * run um `answerType` que o campo não guarda. Esta cópia continua existindo
 * pelos runs já pagos que estão no banco de antes daquela trava: no run
 * aaee7bac o modelo pediu `constraints.teamSize` como `text`, o painel mostrou
 * um campo de texto, a resposta "1" entrou no formulário como string e
 * `constraintsSectionSchema` (z.int()) reprovou o Salvar inteiro — a resposta
 * seguinte, um orçamento perfeitamente válido, morreu junto sem que a tela
 * dissesse por quê.
 *
 * `constraints.urgency` fica fora: é enum e depende das `choices` que só o
 * modelo manda. `*.baselineDate`/`*Date` também: data é texto ISO aqui.
 */
export const FILL_PATH_ANSWER_TYPE: Record<string, 'number' | 'currency' | 'percent' | 'count'> = {
  'marketContext.sam': 'currency',
  'marketContext.som': 'currency',
  'constraints.monthlyGrowthBudget': 'currency',
  'constraints.teamSize': 'count',
  'constraints.growthTeamSize': 'count',
  'currentPerformance.mrr': 'currency',
  'currentPerformance.totalCustomers': 'count',
  'currentPerformance.activeCustomers': 'count',
  'currentPerformance.churnRate': 'percent',
  'currentPerformance.monthlySignups': 'count',
  'currentPerformance.conversionRate': 'percent',
  'currentPerformance.timeToConvert': 'number',
  'currentActivities.contentProduction.blogPostsPerMonth': 'count',
  'currentActivities.contentProduction.socialPostsPerWeek': 'count',
  'currentActivities.contentProduction.emailCampaignsPerMonth': 'count',
  'currentActivities.paidAdvertising.monthlySpend': 'currency',
  targetValue: 'number',
  baselineValue: 'number',
};
