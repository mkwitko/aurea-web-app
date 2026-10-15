import { describe, expect, it } from 'vitest';
import { missingPlanFields, PLAN_REQUIRED_FIELDS } from './experiment-plan-gate';

const ready = {
  metric: 'reply_rate',
  baselineValue: 4.2,
  targetValue: 6,
  startDate: '2026-08-10',
  endDate: '2026-09-07',
  successCriteria: 'Acima de 6%',
  audience: 'Fundadores B2B SaaS',
  channel: 'Email',
};

describe('missingPlanFields', () => {
  it('não acha nada faltando num design completo', () => {
    expect(missingPlanFields(ready)).toEqual([]);
  });

  it('acha os quatro números que a IA não preenche', () => {
    const draft = { ...ready, baselineValue: null, targetValue: null, startDate: null, endDate: null };
    expect(missingPlanFields(draft)).toEqual(['baselineValue', 'targetValue', 'startDate', 'endDate']);
  });

  // Espelho de back/src/http/api/experiments/experiments.domain.ts.
  it('cobre os oito campos que o servidor exige', () => {
    expect(PLAN_REQUIRED_FIELDS).toHaveLength(8);
  });
});
