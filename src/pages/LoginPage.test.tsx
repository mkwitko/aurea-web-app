import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AuthProvider } from '@/lib/auth';
// AuthShell renders the theme toggle, so the page needs the theme context the
// real app gives it from main.tsx.
import { ThemeProvider } from '@/lib/theme';
import { LoginPage } from './LoginPage';

/** A minimal stand-in for the global `Response` the generated client reads. */
function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Unauthorized',
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response;
}

const assign = vi.fn();

beforeEach(() => {
  localStorage.clear();
  assign.mockClear();
  vi.stubGlobal('location', { assign, href: 'http://localhost/login' } as unknown as Location);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LoginPage', () => {
  it('shows the reason the backend gave for refusing the login', async () => {
    // The failure the user hits most often, and the one they can act on: the
    // wrong password. What must reach the screen is the backend's own message,
    // never the client's synthetic "API 401 Unauthorized" and never a generic
    // "something went wrong" that hides which of the two fields is at fault.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse(401, { error: { code: 'AUR-A0002', message: 'Invalid credentials' } }))),
    );

    renderWithProviders(
      <ThemeProvider>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </ThemeProvider>,
    );

    await userEvent.type(screen.getByLabelText('Email'), 'owner@acme.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    // Still on the form, with the tokens untouched: a 401 from a login is not
    // an expired session, so nothing may clear credentials or navigate away.
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(localStorage.getItem('aurea.access')).toBeNull();
    expect(assign).not.toHaveBeenCalled();
  });
});
