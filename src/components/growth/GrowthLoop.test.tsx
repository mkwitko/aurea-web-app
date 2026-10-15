import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { GrowthLoop } from './GrowthLoop';
import type { StageStatus, GrowthStageKey } from '@/lib/growth-stages';

const allTodo: Record<GrowthStageKey, StageStatus> = {
  goals: 'CURRENT',
  research: 'TODO',
  strategies: 'TODO',
  experiments: 'TODO',
  learnings: 'TODO',
};

describe('GrowthLoop', () => {
  it('marks the active stage with aria-current="step" and the others without it', () => {
    renderWithProviders(<GrowthLoop activeStage="goals" states={allTodo} />);

    expect(screen.getByRole('tab', { name: /Goals/i })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('tab', { name: /Research/i })).not.toHaveAttribute('aria-current');
  });

  it('renders a check mark for every DONE stage, and the stage icon otherwise', () => {
    const states: Record<GrowthStageKey, StageStatus> = {
      goals: 'DONE',
      research: 'DONE',
      strategies: 'CURRENT',
      experiments: 'TODO',
      learnings: 'TODO',
    };
    renderWithProviders(<GrowthLoop activeStage="strategies" states={states} />);

    // lucide-react icons render as <svg>; the check icon carries this class,
    // the stage-specific icons (Target, Telescope, …) do not.
    const goalsTab = screen.getByRole('tab', { name: /Goals/i });
    expect(goalsTab.querySelector('svg.lucide-check')).toBeInTheDocument();

    const strategiesTab = screen.getByRole('tab', { name: /Plans/i });
    expect(strategiesTab.querySelector('svg.lucide-check')).not.toBeInTheDocument();
  });

  it('links every stage to its own /app/growth/<stage> route', () => {
    renderWithProviders(<GrowthLoop activeStage="goals" states={allTodo} />);

    expect(screen.getByRole('tab', { name: /Research/i })).toHaveAttribute('href', '/app/growth/research');
    expect(screen.getByRole('tab', { name: /Learnings/i })).toHaveAttribute('href', '/app/growth/learnings');
  });
});
