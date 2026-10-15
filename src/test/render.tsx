import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n';

/**
 * Renders a component with the providers the app gives it: i18n pinned to
 * English so assertions read the en.json copy, a throwaway QueryClient with
 * retries off so a failing request surfaces immediately, and a router.
 *
 * Also returns the `queryClient` itself (additive to the RTL render result)
 * so a test can assert on the query cache's real settled state — e.g.
 * `getQueryState(key)?.status === 'error'` — instead of guessing from timing
 * when a query has actually finished rejecting.
 */
export function renderWithProviders(ui: ReactNode): ReturnType<typeof render> & { queryClient: QueryClient } {
  void i18n.changeLanguage('en');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}
