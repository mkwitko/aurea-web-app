import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch, type StubFetchCall } from '@/test/stub-fetch';
import { LearningsSection } from './LearningsSection';

const learning = {
  id: 'lrn-1',
  workspaceId: 'ws-1',
  experimentId: 'exp-1',
  title: 'Ops leads reply to plain text',
  statement: 'Plain-text first touches booked 9 calls; the templated ones booked none.',
  evidence: null,
  confidence: 'MEDIUM',
  status: 'CANDIDATE',
  createdAt: '2026-08-21T12:00:00.000Z',
  validatedAt: null,
  archivedAt: null,
};

/**
 * `/learnings` is both the list and the create route, and the transitions hang
 * off it too, so only method and path together can tell them apart. The GET
 * answers from whatever the writes have done — the point being to tell "the
 * section re-read the server" apart from "the section painted the button".
 */
function stubLearningsServer(calls: StubFetchCall[], state: { rows: Array<typeof learning> }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      const rawBody = init?.body;
      calls.push({
        method: init?.method ?? 'GET',
        path,
        body: typeof rawBody === 'string' ? (JSON.parse(rawBody) as unknown) : undefined,
      });

      if (path === '/learnings' && init?.method === 'POST') {
        state.rows = [learning];
        return json({ learning });
      }
      if (path.endsWith('/validate')) {
        state.rows = state.rows.map((row) => ({ ...row, status: 'VALIDATED' }));
        return json({ learning: state.rows[0] });
      }
      if (path.endsWith('/reject')) {
        state.rows = state.rows.map((row) => ({ ...row, status: 'REJECTED' }));
        return json({ learning: state.rows[0] });
      }
      return json({ learnings: state.rows });
    }),
  );
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LearningsSection', () => {
  it('lists this experiment learnings with the status each one is in', async () => {
    stubFetch({ '/learnings': { body: { learnings: [learning] } } });

    renderWithProviders(<LearningsSection experimentId="exp-1" />);

    expect(await screen.findByText('Ops leads reply to plain text')).toBeInTheDocument();
    expect(screen.getByText(/booked 9 calls/)).toBeInTheDocument();
    // "Learning candidates are proposed… They are validated before becoming
    // canonical knowledge" — docs/domains/analytics.md §19. The status is the
    // whole difference, so it is on screen.
    expect(screen.getByText('Candidate')).toBeInTheDocument();
  });

  it('says plainly that nothing has been written down yet', async () => {
    stubFetch({ '/learnings': { body: { learnings: [] } } });

    renderWithProviders(<LearningsSection experimentId="exp-1" />);

    expect(await screen.findByText(/nothing written down yet/i)).toBeInTheDocument();
  });

  it('proposes a learning against this experiment and it comes back as a candidate', async () => {
    const calls: StubFetchCall[] = [];
    stubLearningsServer(calls, { rows: [] });

    renderWithProviders(<LearningsSection experimentId="exp-1" />);

    await userEvent.type(await screen.findByLabelText(/^learning$/i), 'Ops leads reply to plain text');
    await userEvent.type(screen.getByLabelText(/what it says/i), 'Plain text booked calls.');
    await userEvent.click(screen.getByRole('button', { name: /propose a learning/i }));

    await waitFor(() => {
      const post = calls.find((call) => call.method === 'POST');
      expect(post?.path).toBe('/learnings');
      expect(post?.body).toEqual({
        experimentId: 'exp-1',
        title: 'Ops leads reply to plain text',
        statement: 'Plain text booked calls.',
      });
    });
    // Never VALIDATED on creation, whatever the form asked for — a candidate is
    // not knowledge.
    expect(await screen.findByText('Candidate')).toBeInTheDocument();
  });

  it('offers only the moves the learning status allows', async () => {
    stubFetch({ '/learnings': { body: { learnings: [{ ...learning, status: 'VALIDATED' }] } } });

    renderWithProviders(<LearningsSection experimentId="exp-1" />);

    expect(await screen.findByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Validate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });

  it('validates a candidate through its own route and re-reads the row', async () => {
    const calls: StubFetchCall[] = [];
    stubLearningsServer(calls, { rows: [learning] });

    renderWithProviders(<LearningsSection experimentId="exp-1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Validate' }));

    await waitFor(() => expect(calls.some((call) => call.path === '/learnings/lrn-1/validate')).toBe(true));
    expect(await screen.findByText('Validated')).toBeInTheDocument();
  });

  it('confirms before rejecting, because a rejected learning cannot come back', async () => {
    const calls: StubFetchCall[] = [];
    stubLearningsServer(calls, { rows: [learning] });

    renderWithProviders(<LearningsSection experimentId="exp-1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));

    expect(calls.some((call) => call.path.endsWith('/reject'))).toBe(false);

    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));

    await waitFor(() => expect(calls.some((call) => call.path === '/learnings/lrn-1/reject')).toBe(true));
    expect(await screen.findByText('Rejected')).toBeInTheDocument();
  });

  it('keeps the status and shows the reason when the server refuses a move', async () => {
    // The mirror in lib/learning-actions can be stale — someone else may have
    // archived this in another tab — and the server decides.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return json({ error: { code: 'AUR-V0001', message: 'Cannot move learning from ARCHIVED to VALIDATED' } }, 400);
        }
        void url;
        return json({ learnings: [learning] });
      }),
    );

    renderWithProviders(<LearningsSection experimentId="exp-1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Validate' }));

    expect(await screen.findByText('Cannot move learning from ARCHIVED to VALIDATED')).toBeInTheDocument();
    expect(screen.getByText('Candidate')).toBeInTheDocument();
  });
});
