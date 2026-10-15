import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { CreditPackCard } from './CreditPackCard';

const base = {
  packId: 'MEDIUM' as const,
  credits: 500,
  priceCents: 79_700,
  currency: 'BRL',
  canBuy: true,
  pending: false,
  onBuy: () => {},
};

describe('CreditPackCard', () => {
  it('shows credits and price', () => {
    renderWithProviders(<CreditPackCard {...base} />);

    expect(screen.getByText('500 credits')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?797\.00/)).toBeInTheDocument();
  });

  it('reports the chosen pack', async () => {
    const onBuy = vi.fn();
    renderWithProviders(<CreditPackCard {...base} onBuy={onBuy} />);

    await userEvent.click(screen.getByRole('button', { name: 'Buy' }));

    expect(onBuy).toHaveBeenCalledWith('MEDIUM');
  });

  it('disables buying and explains it for a member', () => {
    renderWithProviders(<CreditPackCard {...base} canBuy={false} />);

    expect(screen.getByRole('button', { name: 'Buy' })).toBeDisabled();
    expect(screen.getByLabelText('Explain: Who can buy credits')).toBeInTheDocument();
  });
});
