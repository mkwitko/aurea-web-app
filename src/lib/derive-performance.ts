import type { BusinessContextData } from '@/types/business-context';

/**
 * As quatro métricas que uma fórmula calcula, nunca o modelo e nunca uma
 * pergunta.
 *
 * Dois motivos. Modelo erra aritmética, e esta é aritmética sobre o dinheiro
 * do próprio fundador. E uma conta que o usuário vê (R$ 18.000 ÷ 15 clientes)
 * ele confere; uma que o modelo afirmou, não.
 *
 * `params` sai junto do valor para que a tela mostre a conta. A formatação e a
 * tradução são de quem renderiza — este módulo não conhece i18n nem moeda.
 */
export const DERIVED_KEYS = ['arr', 'cac', 'ltv', 'ltvCacRatio'] as const;

export type DerivedKey = (typeof DERIVED_KEYS)[number];

export interface DerivedValue {
  value: number;
  params: Record<string, number>;
}

/** Um número utilizável, ou nada. NaN e Infinity não são números utilizáveis. */
function usable(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Divisão que devolve undefined em entrada ausente e em divisor zero.
 *
 * `churnRate: 0` é resposta real de um fundador, e tem que produzir LTV vazio
 * — nunca Infinity, que renderizaria como "∞" num campo de dinheiro e depois
 * seria salvo assim.
 */
function ratio(numerator: number | undefined, denominator: number | undefined): number | undefined {
  if (numerator === undefined || denominator === undefined || denominator === 0) return undefined;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : undefined;
}

export function derivePerformance(data: BusinessContextData): Partial<Record<DerivedKey, DerivedValue>> {
  const performance = data.currentPerformance;

  const mrr = usable(performance?.mrr);
  const activeCustomers = usable(performance?.activeCustomers);
  const churnRate = usable(performance?.churnRate);
  const monthlySignups = usable(performance?.monthlySignups);
  const monthlySpend = usable(data.currentActivities?.paidAdvertising?.monthlySpend);

  const derived: Partial<Record<DerivedKey, DerivedValue>> = {};

  if (mrr !== undefined) derived.arr = { value: mrr * 12, params: { mrr } };

  const cac = ratio(monthlySpend, monthlySignups);
  if (cac !== undefined && monthlySpend !== undefined && monthlySignups !== undefined) {
    derived.cac = { value: cac, params: { monthlySpend, monthlySignups } };
  }

  // Receita por cliente ativo dividida pelo churn: quanto cada cliente traz
  // por mês, vezes quantos meses ele fica.
  const revenuePerCustomer = ratio(mrr, activeCustomers);
  const ltv = ratio(revenuePerCustomer, churnRate);
  if (ltv !== undefined && mrr !== undefined && activeCustomers !== undefined && churnRate !== undefined) {
    derived.ltv = { value: ltv, params: { mrr, activeCustomers, churnRate } };
  }

  const ltvCacRatio = ratio(ltv, cac);
  if (ltvCacRatio !== undefined && ltv !== undefined && cac !== undefined) {
    derived.ltvCacRatio = { value: ltvCacRatio, params: { ltv, cac } };
  }

  return derived;
}
