import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { LoopRail } from './LoopRail';

function renderAt(path: string) {
  void i18n.changeLanguage('en');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LoopRail />
    </MemoryRouter>,
  );
}

describe('LoopRail', () => {
  it('marks the stage the user is on', () => {
    renderAt('/app/experiments');

    expect(screen.getByRole('link', { name: /Tests/ })).toHaveAttribute('aria-current', 'step');
  });

  it('still marks the stage on a page nested under it', () => {
    // The rail is a progress indicator, so it has to keep pointing at the
    // stage while the user works inside it. Matching the path exactly meant an
    // experiment's own page — or a strategy's — lit up nothing at all, and the
    // earlier stages stopped reading as completed.
    renderAt('/app/experiments/exp-1');

    expect(screen.getByRole('link', { name: /Tests/ })).toHaveAttribute('aria-current', 'step');
  });

  it('marks exactly one stage', () => {
    renderAt('/app/strategies/str-1');

    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(/Plans/);
  });

  it('marks the research stage between goals and strategies', () => {
    // Research sits at 04 now that it has its own stage in the loop, which
    // pushed Plans to 05 and Tests to 06 — this pins that shift.
    renderAt('/app/research');

    expect(screen.getByRole('link', { name: /Research/ })).toHaveAttribute('aria-current', 'step');
  });

  it('renumbers the stages after research', () => {
    renderAt('/app/goals');

    expect(screen.getByRole('link', { name: /Research/ })).toHaveTextContent('04');
    expect(screen.getByRole('link', { name: /Plans/ })).toHaveTextContent('05');
    expect(screen.getByRole('link', { name: /Tests/ })).toHaveTextContent('06');
  });

  it('marks nothing outside the loop', () => {
    // Billing is not a stage of the growth loop, so the rail must not claim the
    // user is somewhere in it.
    renderAt('/app/settings/billing');

    expect(screen.queryByRole('link', { current: 'step' })).not.toBeInTheDocument();
  });
});
