import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { allowedExperimentActions } from '@/lib/experiment-actions';
import { allowedLearningActions } from '@/lib/learning-actions';
import { LifecycleActions } from './LifecycleActions';

describe('LifecycleActions', () => {
  it('offers one button per allowed move, labelled by what it does', async () => {
    const onAct = vi.fn();

    renderWithProviders(
      <LifecycleActions moves={allowedExperimentActions('APPROVED')} labelKey="pages.experiments.action" pending={false} onAct={onAct} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(onAct).toHaveBeenCalledWith('start');
  });

  it('renders nothing at all for a finished lifecycle', () => {
    // COMPLETED has no outgoing edge, so an action bar there would be a row of
    // buttons whose only possible outcome is a 400.
    const { container } = renderWithProviders(
      <LifecycleActions moves={allowedExperimentActions('COMPLETED')} labelKey="pages.experiments.action" pending={false} onAct={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('locks every button while a move is in flight', async () => {
    // Two transitions from one click sequence is the same class of bug as a
    // double proration: the second one lands on a status the first just left.
    const onAct = vi.fn();

    renderWithProviders(
      <LifecycleActions moves={allowedExperimentActions('RUNNING')} labelKey="pages.experiments.action" pending onAct={onAct} />,
    );

    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onAct).not.toHaveBeenCalled();
  });

  it('makes a terminal move confirm before it fires', async () => {
    // Cancelling is irreversible — the transition table has no edge out of
    // CANCELLED — so it must not be one misplaced click away.
    const onAct = vi.fn();

    renderWithProviders(
      <LifecycleActions moves={allowedExperimentActions('RUNNING')} labelKey="pages.experiments.action" pending={false} onAct={onAct} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancel experiment' }));
    expect(onAct).not.toHaveBeenCalled();

    // The dialog says why it matters, and only its own confirm performs the
    // move — scoped with `within` because the trigger and the confirm carry the
    // same label on purpose.
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel experiment' }));

    expect(onAct).toHaveBeenCalledWith('cancel');
  });

  it('gives each irreversible move its own confirmation copy', async () => {
    // Learnings have two different terminal moves — rejecting and archiving —
    // so one shared dialog per domain would put "Reject this learning?" in
    // front of the archive button. The confirmation has to describe the move
    // that is actually about to happen.
    renderWithProviders(
      <LifecycleActions
        moves={allowedLearningActions('CANDIDATE')}
        labelKey="pages.experiments.learnings.action"
        pending={false}
        onAct={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(/reject this learning/i);
  });

  it('describes archiving as archiving, not as the domain other terminal move', async () => {
    renderWithProviders(
      <LifecycleActions
        moves={allowedLearningActions('VALIDATED')}
        labelKey="pages.experiments.learnings.action"
        pending={false}
        onAct={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(/archive this learning/i);
    expect(dialog).not.toHaveTextContent(/reject/i);
  });

  it('fires a non-destructive move without a confirmation step', async () => {
    const onAct = vi.fn();

    renderWithProviders(
      <LifecycleActions moves={allowedExperimentActions('RUNNING')} labelKey="pages.experiments.action" pending={false} onAct={onAct} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Complete' }));

    expect(onAct).toHaveBeenCalledWith('complete');
  });
});
