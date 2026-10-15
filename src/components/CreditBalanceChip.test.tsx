import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { CREDITS } from '@/api/modules/credits';
import { CreditBalanceChip } from './CreditBalanceChip';

const credits = {
  plan: 'GROWTH',
  allowance: 1_000,
  consumed: 400,
  purchasedBalance: 850,
  periodStart: '2026-07-28T00:00:00.000Z',
  periodEnd: '2026-08-28T00:00:00.000Z',
};

describe('CreditBalanceChip', () => {
  it('shows the spendable balance and links to billing', async () => {
    stubFetch({ [CREDITS.ENDPOINT]: { body: credits } });

    renderWithProviders(<CreditBalanceChip />);

    const link = await screen.findByRole('link', { name: /Credits available/ });
    expect(link).toHaveAttribute('href', '/app/settings/billing');
    expect(link).toHaveTextContent('1450');
  });

  it('stays out of the way when credits cannot be read', async () => {
    stubFetch({ [CREDITS.ENDPOINT]: { status: 500, body: { error: { code: 'AUR-T0001', message: 'boom' } } } });

    const { container, queryClient } = renderWithProviders(<CreditBalanceChip />);

    // Wait for the query to actually settle into `error` before asserting on
    // the DOM. A same-tick check would pass merely because the request is
    // still in flight (the chip also renders nothing while loading), so it
    // wouldn't prove the error path specifically.
    await waitFor(() => expect(queryClient.getQueryState(CREDITS.queryKeyRoot)?.status).toBe('error'));

    expect(container.querySelector('a')).toBeNull();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('hides the balance once a refresh errors, even though the last-known value is still cached', async () => {
    // Proves `isError` is load-bearing and not redundant with `!data`: once a
    // query has succeeded, TanStack Query keeps the last-known `data` in the
    // cache across a failed background refetch instead of clearing it, so a
    // stale (possibly wrong) balance must be actively hidden by checking
    // `isError`, not merely inferred from `data` being absent.
    stubFetch({ [CREDITS.ENDPOINT]: { body: credits } });

    const { queryClient } = renderWithProviders(<CreditBalanceChip />);

    await screen.findByRole('link', { name: /Credits available/ });

    stubFetch({ [CREDITS.ENDPOINT]: { status: 500, body: { error: { code: 'AUR-T0001', message: 'boom' } } } });
    await queryClient.refetchQueries({ queryKey: CREDITS.queryKeyRoot }).catch(() => {});

    await waitFor(() => expect(queryClient.getQueryState(CREDITS.queryKeyRoot)?.status).toBe('error'));
    // The stale value is still in the cache — confirms this exercises "error
    // with cached data present", not "error with no data yet" (that case is
    // already covered above).
    expect(queryClient.getQueryState(CREDITS.queryKeyRoot)?.data).toEqual(credits);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
