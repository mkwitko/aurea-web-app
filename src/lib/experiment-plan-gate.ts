/**
 * Espelha `PLAN_REQUIRED_FIELDS` em
 * `back/src/http/api/experiments/experiments.domain.ts`. O servidor recusa o
 * PLANNED de novo — isto só existe para dizer ao fundador o que falta antes de
 * ele tentar, e para contar os campos no marcador do rascunho.
 */
export const PLAN_REQUIRED_FIELDS = [
  'metric',
  'baselineValue',
  'targetValue',
  'startDate',
  'endDate',
  'successCriteria',
  'audience',
  'channel',
] as const;

export type PlanRequiredField = (typeof PLAN_REQUIRED_FIELDS)[number];

export function missingPlanFields(experiment: Partial<Record<PlanRequiredField, unknown>>): PlanRequiredField[] {
  return PLAN_REQUIRED_FIELDS.filter((field) => {
    const value = experiment[field];
    return value === null || value === undefined || value === '';
  });
}
