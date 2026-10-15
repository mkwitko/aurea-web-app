import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { PerformanceMetricsGrid } from './PerformanceMetricsGrid';
import type { BusinessContextData } from '@/types/business-context';

/** Reads the actual copy through i18n, the same idiom as AiFillButton.test.tsx. */
const copy = (key: string, options?: Record<string, unknown>): string => i18n.t(key, options ?? {});

/** Same shape derive-performance.test.ts uses: a loosely-typed performance slice, cast at the edge. */
const context = (performance: Record<string, unknown>, monthlySpend?: number): BusinessContextData =>
  ({
    currentPerformance: performance,
    currentActivities: monthlySpend === undefined ? undefined : { paidAdvertising: { monthlySpend } },
  }) as unknown as BusinessContextData;

describe('PerformanceMetricsGrid — derived fields', () => {
  it('shows the derived ARR when mrr is filled and arr is not', () => {
    renderWithProviders(<PerformanceMetricsGrid data={context({ mrr: 10_000 })} update={vi.fn()} />);

    expect(screen.getByLabelText(copy('wizard.performance.arr'))).toHaveValue(120_000);
  });

  it('shows the arithmetic caption under it', () => {
    renderWithProviders(<PerformanceMetricsGrid data={context({ mrr: 10_000 })} update={vi.fn()} />);

    expect(screen.getByText(copy('wizard.performance.derived.arr', { mrr: 10_000 }))).toBeInTheDocument();
  });

  it('shows the typed value and no caption when the founder typed over arr', () => {
    // The form is the source of truth once the founder has typed something:
    // the formula stays available as a fallback, never as an override.
    renderWithProviders(<PerformanceMetricsGrid data={context({ mrr: 10_000, arr: 999_000 })} update={vi.fn()} />);

    expect(screen.getByLabelText(copy('wizard.performance.arr'))).toHaveValue(999_000);
    expect(screen.queryByText(copy('wizard.performance.derived.arr'))).not.toBeInTheDocument();
  });

  it('shows nothing for ltv when churnRate is 0', () => {
    // Zero cancellations is a real answer, and derivePerformance leaves ltv
    // (and ltvCacRatio) undefined for it rather than Infinity — the grid must
    // not show a caption for a value it never computed.
    renderWithProviders(
      <PerformanceMetricsGrid data={context({ mrr: 45_000, activeCustomers: 180, churnRate: 0 })} update={vi.fn()} />,
    );

    expect(screen.getByLabelText(copy('wizard.performance.ltv'))).toHaveValue(null);
    expect(screen.queryByText(/revenue per customer/)).not.toBeInTheDocument();
  });
});
