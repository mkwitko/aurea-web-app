import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UiModeProvider, useUiMode } from './ui-mode';

function Probe() {
  const { mode, toggle, setMode } = useUiMode();
  return (
    <div>
      <span>mode: {mode}</span>
      <button onClick={toggle}>toggle</button>
      <button onClick={() => setMode('advanced')}>go advanced</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('useUiMode', () => {
  it('defaults to simple when nothing is stored', () => {
    render(
      <UiModeProvider>
        <Probe />
      </UiModeProvider>,
    );
    expect(screen.getByText('mode: simple')).toBeInTheDocument();
  });

  it('reads a previously stored mode on mount', () => {
    localStorage.setItem('aurea.uiMode', 'advanced');
    render(
      <UiModeProvider>
        <Probe />
      </UiModeProvider>,
    );
    expect(screen.getByText('mode: advanced')).toBeInTheDocument();
  });

  it('persists the mode across a fresh mount — the whole point of storing it', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <UiModeProvider>
        <Probe />
      </UiModeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByText('mode: advanced')).toBeInTheDocument();
    expect(localStorage.getItem('aurea.uiMode')).toBe('advanced');

    unmount();

    render(
      <UiModeProvider>
        <Probe />
      </UiModeProvider>,
    );
    expect(screen.getByText('mode: advanced')).toBeInTheDocument();
  });

  it('toggle flips back to simple', async () => {
    const user = userEvent.setup();
    render(
      <UiModeProvider>
        <Probe />
      </UiModeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'go advanced' }));
    expect(screen.getByText('mode: advanced')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'toggle' }));
    expect(screen.getByText('mode: simple')).toBeInTheDocument();
  });

  it('throws when used outside the provider', () => {
    // Swallow the expected console.error React logs for the thrown render.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useUiMode must be used within UiModeProvider');
    spy.mockRestore();
  });
});
