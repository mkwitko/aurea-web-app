import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { UiModeProvider } from '@/lib/ui-mode';
import { ListRoute } from './App';

function renderListRoute(initialPath = '/app/goals') {
  return render(
    <UiModeProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/app/goals" element={<ListRoute stage="goals" page={<div>raw goals page</div>} />} />
          <Route path="/app/growth/:stage" element={<div>growth page: goals</div>} />
        </Routes>
      </MemoryRouter>
    </UiModeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('ListRoute', () => {
  it('redirects to the merged growth page in simple mode (the default)', () => {
    renderListRoute();

    expect(screen.getByText('growth page: goals')).toBeInTheDocument();
    expect(screen.queryByText('raw goals page')).not.toBeInTheDocument();
  });

  it('renders the raw page in advanced mode', () => {
    localStorage.setItem('aurea.uiMode', 'advanced');

    renderListRoute();

    expect(screen.getByText('raw goals page')).toBeInTheDocument();
    expect(screen.queryByText('growth page: goals')).not.toBeInTheDocument();
  });
});
