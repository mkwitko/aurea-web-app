import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WorkspaceProvider, useWorkspace } from './workspace';

function Probe() {
  const { workspaceId, setWorkspaceId } = useWorkspace();
  return (
    <div>
      <span data-testid="probe">{workspaceId ?? 'none'}</span>
      <button onClick={() => setWorkspaceId('ws-2')}>switch</button>
    </div>
  );
}

function renderProbe(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkspaceProvider>
        <Probe />
      </WorkspaceProvider>
    </QueryClientProvider>,
  );
}

describe('WorkspaceProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('starts with nothing selected, leaving the server fallback to pick', () => {
    const queryClient = new QueryClient();
    renderProbe(queryClient);

    expect(screen.getByTestId('probe').textContent).toBe('none');
  });

  it('reads a previously picked workspace back from localStorage on load', () => {
    localStorage.setItem('aurea.workspaceId', 'ws-1');
    const queryClient = new QueryClient();
    renderProbe(queryClient);

    expect(screen.getByTestId('probe').textContent).toBe('ws-1');
  });

  it('persists a switch to localStorage and clears every cached query', () => {
    const queryClient = new QueryClient();
    // Something cached under the previous workspace — must not survive the
    // switch, since it would otherwise show one company's data under another.
    queryClient.setQueryData(['stale-under-old-workspace'], { some: 'data' });

    renderProbe(queryClient);
    fireEvent.click(screen.getByText('switch'));

    expect(screen.getByTestId('probe').textContent).toBe('ws-2');
    expect(localStorage.getItem('aurea.workspaceId')).toBe('ws-2');
    expect(queryClient.getQueryData(['stale-under-old-workspace'])).toBeUndefined();
  });
});
