import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { NextActionCard, type DashboardNextAction } from './NextActionCard';

function action(overrides: Partial<DashboardNextAction> = {}): DashboardNextAction {
  return {
    kind: 'RECORD_OUTCOME',
    subjectLabel: 'LinkedIn DM test',
    experimentId: 'e1',
    learningId: null,
    endDate: null,
    ...overrides,
  };
}

describe('NextActionCard', () => {
  it('renders the copy for the kind, with the subject interpolated', () => {
    renderWithProviders(<NextActionCard nextAction={action()} />);

    expect(
      screen.getByText(i18n.t('app.dashboard.next.RECORD_OUTCOME', { subject: 'LinkedIn DM test' })),
    ).toBeInTheDocument();
  });

  it('links the button at the route for the kind', () => {
    renderWithProviders(<NextActionCard nextAction={action()} />);

    expect(screen.getByRole('link', { name: i18n.t('app.dashboard.go') })).toHaveAttribute(
      'href',
      '/app/experiments/e1',
    );
  });

  it('renders no button at all while an experiment is still running', () => {
    const endDate = '2026-08-10T00:00:00.000Z';
    renderWithProviders(<NextActionCard nextAction={action({ kind: 'WAIT_FOR_EXPERIMENT', endDate })} />);

    // Pinned via the same Intl call the component uses, not a hardcoded
    // string, so this assertion holds regardless of the host machine's
    // timezone while still failing if the component ever drops
    // Intl.DateTimeFormat or leaks the raw ISO string instead.
    const formattedDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(endDate));
    expect(screen.getByTestId('next-action-text')).toHaveTextContent(formattedDate);

    // A dashboard that always demands a click invents work.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('survives a waiting experiment with no end date', () => {
    renderWithProviders(<NextActionCard nextAction={action({ kind: 'WAIT_FOR_EXPERIMENT', endDate: null })} />);

    // No planned end date is a real RUNNING state, not missing data — it
    // gets its own copy (app.dashboard.waitNoDate), not the dated copy with
    // an empty interpolation (which would dangle the preposition).
    expect(screen.getByTestId('next-action-text')).toHaveTextContent(
      i18n.t('app.dashboard.waitNoDate', { subject: 'LinkedIn DM test' }),
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders a setup action that names no subject', () => {
    renderWithProviders(
      <NextActionCard nextAction={action({ kind: 'SET_UP_BUSINESS', subjectLabel: null, experimentId: null })} />,
    );

    expect(screen.getByRole('link', { name: i18n.t('app.dashboard.go') })).toHaveAttribute(
      'href',
      '/app/business/profile',
    );
  });
});
