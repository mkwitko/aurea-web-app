import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PlanCard } from './PlanCard';

const base = {
  plan: 'GROWTH' as const,
  monthlyCredits: 1_000,
  maxWorkspaces: 3,
  priceCents: 99_700,
  currency: 'BRL',
  isCurrent: false,
  canSwitch: false,
  canManage: true,
  pending: false,
  onChoose: () => {},
};

describe('PlanCard', () => {
  it('shows credits, workspace cap and price', () => {
    renderWithProviders(<PlanCard {...base} />);

    expect(screen.getByText('1000 credits/month')).toBeInTheDocument();
    expect(screen.getByText('Up to 3 workspaces')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?997\.00/)).toBeInTheDocument();
  });

  it('marks the current plan and offers no action for it', () => {
    renderWithProviders(<PlanCard {...base} isCurrent canSwitch />);

    expect(screen.getByText('Current plan')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  // The label has to match what the click actually does: with a live
  // subscription the plan is switched in place, without one the user is sent
  // through checkout to create it.
  it('says subscribe when there is nothing to switch and switch when there is', () => {
    const { unmount } = renderWithProviders(<PlanCard {...base} />);
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeEnabled();
    unmount();

    renderWithProviders(<PlanCard {...base} canSwitch />);
    expect(screen.getByRole('button', { name: 'Switch to this plan' })).toBeEnabled();
  });

  it('disables the action and explains it when the user cannot manage billing', () => {
    renderWithProviders(<PlanCard {...base} canManage={false} />);

    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
    expect(screen.getByLabelText('Explain: Who can change the plan')).toBeInTheDocument();
  });

  it('reports the chosen plan', async () => {
    const onChoose = vi.fn();
    renderWithProviders(<PlanCard {...base} onChoose={onChoose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));

    expect(onChoose).toHaveBeenCalledWith('GROWTH');
  });

  it('disables the action while a checkout is being created', () => {
    renderWithProviders(<PlanCard {...base} pending />);
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeDisabled();
  });
});
