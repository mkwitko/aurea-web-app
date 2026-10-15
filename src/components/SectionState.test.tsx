import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { SectionLoadError } from './SectionState';

describe('SectionLoadError', () => {
  it('retries every query it was given, all at once', async () => {
    // The two section tests cover this through their own fetch traffic; this
    // pins it on the shared primitive itself, which is where a future section
    // will inherit it from. Both requirements are here: nothing is left
    // un-refetched (a failed sibling would keep the section on this card
    // forever), and no query waits for another to finish first.
    let settleFirst: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      settleFirst = resolve;
    });
    const started: string[] = [];
    const refetchFirst = () => {
      started.push('first');
      return first;
    };
    const refetchSecond = () => {
      started.push('second');
      return Promise.resolve();
    };

    renderWithProviders(<SectionLoadError refetch={[refetchFirst, refetchSecond]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(started).toEqual(['first', 'second']);

    settleFirst();
  });
});
