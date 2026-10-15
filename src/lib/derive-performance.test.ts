import { describe, expect, it } from 'vitest';
import { derivePerformance, DERIVED_KEYS } from './derive-performance';
import type { BusinessContextData } from '@/types/business-context';

const context = (
  performance: Record<string, unknown>,
  monthlySpend?: number,
): BusinessContextData =>
  ({
    currentPerformance: performance,
    currentActivities: monthlySpend === undefined ? undefined : { paidAdvertising: { monthlySpend } },
  }) as unknown as BusinessContextData;

describe('derivePerformance', () => {
  it('computes arr from mrr', () => {
    expect(derivePerformance(context({ mrr: 45_000 })).arr).toEqual({
      value: 540_000,
      params: { mrr: 45_000 },
    });
  });

  it('computes cac from ad spend and new customers', () => {
    expect(derivePerformance(context({ monthlySignups: 15 }, 18_000)).cac).toEqual({
      value: 1_200,
      params: { monthlySpend: 18_000, monthlySignups: 15 },
    });
  });

  it('computes ltv from revenue per active customer and churn', () => {
    // 45000 / 180 = 250 per customer per month; at 5% monthly churn a customer
    // stays 20 months.
    const result = derivePerformance(context({ mrr: 45_000, activeCustomers: 180, churnRate: 0.05 }));
    expect(result.ltv?.value).toBeCloseTo(5_000);
  });

  it('computes ltvCacRatio from the two it just derived', () => {
    const result = derivePerformance(
      context({ mrr: 45_000, activeCustomers: 180, churnRate: 0.05, monthlySignups: 15 }, 18_000),
    );
    expect(result.ltvCacRatio?.value).toBeCloseTo(5_000 / 1_200);
  });

  it('leaves ltv empty when churn is zero, never Infinity', () => {
    // Zero cancellations is a real answer a founder can give. An Infinity here
    // would render as "∞" in a money field and then be saved as one.
    const result = derivePerformance(context({ mrr: 45_000, activeCustomers: 180, churnRate: 0 }));
    expect(result.ltv).toBeUndefined();
    expect(result.ltvCacRatio).toBeUndefined();
  });

  it('leaves cac empty when there were no new customers', () => {
    expect(derivePerformance(context({ monthlySignups: 0 }, 18_000)).cac).toBeUndefined();
  });

  it('leaves cac empty when there is no ad spend recorded', () => {
    // Absent is not zero: a company that spends nothing on ads has no CAC by
    // this formula, and a zero would read as "customers are free".
    expect(derivePerformance(context({ monthlySignups: 15 })).cac).toBeUndefined();
  });

  it('leaves everything empty for an empty context', () => {
    expect(derivePerformance({} as BusinessContextData)).toEqual({});
  });

  it('recomputes transitively when one input changes', () => {
    const before = derivePerformance(
      context({ mrr: 45_000, activeCustomers: 180, churnRate: 0.05, monthlySignups: 15 }, 18_000),
    );
    const after = derivePerformance(
      context({ mrr: 90_000, activeCustomers: 180, churnRate: 0.05, monthlySignups: 15 }, 18_000),
    );
    expect(after.arr?.value).not.toBe(before.arr?.value);
    expect(after.ltv?.value).not.toBe(before.ltv?.value);
    expect(after.ltvCacRatio?.value).not.toBe(before.ltvCacRatio?.value);
    // CAC does not depend on revenue and must not move.
    expect(after.cac?.value).toBe(before.cac?.value);
  });

  it('ignores a NaN or infinite input rather than propagating it', () => {
    expect(derivePerformance(context({ mrr: Number.NaN }))).toEqual({});
    expect(derivePerformance(context({ mrr: Number.POSITIVE_INFINITY }))).toEqual({});
  });

  it('derives exactly the four keys and no others', () => {
    expect(DERIVED_KEYS).toEqual(['arr', 'cac', 'ltv', 'ltvCacRatio']);
  });
});
