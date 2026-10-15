import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { AuthProvider } from '@/lib/auth';
import { WorkspaceGate } from './WorkspaceGate';

function meBody(workspaceId: string | null) {
  return {
    user: { id: '11111111-1111-1111-1111-111111111111', email: 'a@b.com', name: 'A' },
    memberships: [{ organizationId: '22222222-2222-2222-2222-222222222222', workspaceId, role: 'OWNER' }],
  };
}

function renderGate() {
  return renderWithProviders(
    <AuthProvider>
      <Routes>
        <Route path="/" element={<WorkspaceGate><div>app shell</div></WorkspaceGate>} />
        <Route path="/app/workspaces/new" element={<div>create workspace</div>} />
      </Routes>
    </AuthProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('WorkspaceGate', () => {
  it('sends an account with no workspace to the create screen', async () => {
    localStorage.setItem('aurea.access', 'token');
    stubFetch({ '/auth/me': { body: meBody(null) } });

    renderGate();

    expect(await screen.findByText('create workspace')).toBeInTheDocument();
  });

  it('renders the app once a workspace membership exists', async () => {
    localStorage.setItem('aurea.access', 'token');
    stubFetch({ '/auth/me': { body: meBody('33333333-3333-3333-3333-333333333333') } });

    renderGate();

    expect(await screen.findByText('app shell')).toBeInTheDocument();
  });
});
