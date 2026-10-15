import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { Help } from './Help';

describe('Help', () => {
  it('is reachable by keyboard and opens its explanation on focus', async () => {
    renderWithProviders(<Help title="Widget">Widgets are great.</Help>);

    const trigger = screen.getByLabelText('Explain: Widget');
    await userEvent.tab();

    expect(trigger).toHaveFocus();
    expect(await screen.findByText('Widgets are great.')).toBeVisible();
  });

  it('opens on a tap, where there is no hover to open it', async () => {
    // Radix's hover card deliberately ignores touch pointers, and a tap does
    // not reliably focus a non-input element either — so on a phone, the
    // primary device for this audience, hover and focus both give nothing and
    // the explanation is unreachable. The app is the docs: it has to open.
    renderWithProviders(<Help title="Widget">Widgets are great.</Help>);

    const trigger = screen.getByLabelText('Explain: Widget');
    fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
    fireEvent.click(trigger, { pointerType: 'touch' });

    expect(await screen.findByText('Widgets are great.')).toBeVisible();
  });

  it('reopens on Enter after the card has been dismissed', async () => {
    // Focus opens the card and Escape dismisses it — both already true. What
    // fails is the state after that: the trigger still holds focus, so no new
    // focus event is coming, and a trigger claiming role="button" that does
    // nothing on Enter leaves the keyboard user with no way back to the
    // explanation short of tabbing away and back.
    renderWithProviders(<Help title="Widget">Widgets are great.</Help>);

    const trigger = screen.getByLabelText('Explain: Widget');
    trigger.focus();
    expect(await screen.findByText('Widgets are great.')).toBeVisible();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Widgets are great.')).not.toBeInTheDocument());

    expect(trigger).toHaveFocus();
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(await screen.findByText('Widgets are great.')).toBeVisible();
  });
});
