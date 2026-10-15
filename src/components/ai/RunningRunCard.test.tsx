import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import i18n from '@/i18n';
import { renderWithProviders } from '@/test/render';
import { RunningRunCard } from './RunningRunCard';

const copy = (key: string): string => i18n.t(key);

afterEach(() => {
  vi.useRealTimers();
});

describe('RunningRunCard', () => {
  it('counts up from the moment the run started', async () => {
    vi.useFakeTimers();
    const startedAt = new Date('2026-07-31T12:00:00.000Z');
    vi.setSystemTime(new Date('2026-07-31T12:00:42.000Z'));

    renderWithProviders(
      <RunningRunCard startedAt={startedAt} onCancel={vi.fn()} isCancelling={false} />,
    );

    // Sem esperar o primeiro tick: um card que só mostra o tempo depois de um
    // segundo pisca "00:00" no run que já roda há minutos.
    expect(screen.getByText('00:42')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(screen.getByText('01:42')).toBeInTheDocument();
  });

  // Um run que nunca começou não tem de onde contar, e um cronômetro chutado
  // mente sobre há quanto tempo o fundador está esperando.
  it('shows no clock when the start time is unknown', () => {
    renderWithProviders(<RunningRunCard startedAt={null} onCancel={vi.fn()} isCancelling={false} />);

    expect(screen.queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy('ai.fill.cancel') })).toBeEnabled();
  });

  it('says the work belongs to another request when the run is foreign', async () => {
    const onCancel = vi.fn();
    renderWithProviders(
      <RunningRunCard startedAt={null} isForeign onCancel={onCancel} isCancelling={false} />,
    );

    expect(screen.getByText(new RegExp(copy('ai.fill.otherRunning')))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: copy('ai.fill.cancel') }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('disables the cancel button while the cancellation is in flight', () => {
    renderWithProviders(<RunningRunCard startedAt={null} onCancel={vi.fn()} isCancelling />);

    expect(screen.getByRole('button', { name: copy('ai.fill.cancel') })).toBeDisabled();
  });
});
