import { screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { stubFetch } from '@/test/stub-fetch';
import { LearningsPage } from './LearningsPage';

const learning = {
  id: 'l1',
  title: 'Ops leads reply faster to a plain-text email',
  statement: 'Plain-text outreach outperformed the templated one on reply rate.',
  status: 'VALIDATED',
  confidence: 'HIGH',
  experimentId: null,
  createdAt: '2026-07-20T00:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LearningsPage', () => {
  it('renders the page chrome and the learnings list panel together', async () => {
    stubFetch({
      '/learnings': { body: { learnings: [learning] } },
      '/experiments': { body: { experiments: [] } },
    });

    renderWithProviders(<LearningsPage />);

    expect(screen.getByRole('heading', { name: 'Learnings' })).toBeInTheDocument();
    expect(await screen.findByText(learning.title)).toBeInTheDocument();
  });
});
