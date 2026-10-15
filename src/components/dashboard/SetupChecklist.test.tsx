import { act, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { SetupChecklist } from './SetupChecklist';

await i18n.changeLanguage('en');

// Contexto, hipótese e experimento eram invisíveis na home antes disto: um
// workspace podia dizer "5 de 5" sem contexto nenhum preenchido.
const HALF = {
  business: true, context: true, icp: true, goal: true,
  research: false, strategy: false, hypothesis: false, experiment: false,
  completed: 4, total: 8,
};
const DONE = {
  business: true, context: true, icp: true, goal: true,
  research: true, strategy: true, hypothesis: true, experiment: true,
  completed: 8, total: 8,
};

function rowFor(link: HTMLElement): HTMLElement {
  const row = link.closest('.group');
  if (!row) throw new Error('step row not found');
  return row as HTMLElement;
}

describe('SetupChecklist expanded', () => {
  it('renders eight steps with research at 05 and strategy at 06', () => {
    renderWithProviders(<SetupChecklist setup={HALF} collapsed={false} />);

    const research = screen.getByRole('link', { name: i18n.t('app.dashboard.steps.research.title') });
    const strategy = screen.getByRole('link', { name: i18n.t('app.dashboard.steps.strategy.title') });

    expect(within(rowFor(research)).getByText('05')).toBeInTheDocument();
    expect(within(rowFor(strategy)).getByText('06')).toBeInTheDocument();
  });

  it('shows progress as a count and a percentage', () => {
    renderWithProviders(<SetupChecklist setup={HALF} collapsed={false} />);

    expect(screen.getByText('4 / 8')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('renders one row per onboarding step', () => {
    renderWithProviders(<SetupChecklist setup={HALF} collapsed={false} />);
    for (const title of ['Business', 'Context', 'Ideal customer', 'Goal', 'Research', 'Strategy', 'Hypothesis', 'Experiment']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });
});

describe('SetupChecklist collapsed', () => {
  it('hides the step rows behind a summary', () => {
    renderWithProviders(<SetupChecklist setup={DONE} collapsed />);

    expect(screen.getByText(i18n.t('app.dashboard.setupDone', { completed: 8, total: 8 }))).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: i18n.t('app.dashboard.steps.research.title') })).not.toBeInTheDocument();
  });

  it('reports progress out of eight when collapsed', () => {
    render(<MemoryRouter><SetupChecklist setup={DONE} collapsed /></MemoryRouter>);
    expect(screen.getByText(/8.*8/)).toBeInTheDocument();
  });

  it('reveals the rows when the summary is opened', async () => {
    renderWithProviders(<SetupChecklist setup={DONE} collapsed />);

    // <details>/<summary>: opening is a native toggle, so the test drives the
    // element rather than simulating a pointer.
    const details = document.querySelector('details');
    expect(details).not.toBeNull();
    (details as HTMLDetailsElement).open = true;
    // jsdom does not fire `toggle` for a programmatic `.open` assignment (only
    // real browsers reliably do), so dispatch it ourselves. `toggle` doesn't
    // bubble, but React attaches its `onToggle` listener directly on the DOM
    // node, so a manually dispatched event still reaches the handler.
    act(() => {
      details?.dispatchEvent(new Event('toggle'));
    });

    expect(await screen.findByRole('link', { name: i18n.t('app.dashboard.steps.research.title') })).toBeInTheDocument();
  });
});
