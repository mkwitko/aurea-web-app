import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { AllowanceBar } from './AllowanceBar';

describe('AllowanceBar', () => {
  it('reports consumption as a labelled progress bar', () => {
    renderWithProviders(<AllowanceBar allowance={1_000} consumed={400} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '400');
    expect(bar).toHaveAttribute('aria-valuemax', '1000');
    expect(screen.getByText('400 of 1000 used')).toBeInTheDocument();
  });

  it('caps the bar at full when consumption passes the allowance', () => {
    renderWithProviders(<AllowanceBar allowance={200} consumed={260} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '200');
    expect(screen.getByText('Allowance used up for this period.')).toBeInTheDocument();
  });

  it('handles a zero allowance without dividing by zero', () => {
    renderWithProviders(<AllowanceBar allowance={0} consumed={0} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '0');
    expect(screen.getByText('0 of 0 used')).toBeInTheDocument();
    expect(screen.queryByText('Allowance used up for this period.')).not.toBeInTheDocument();
  });
});
