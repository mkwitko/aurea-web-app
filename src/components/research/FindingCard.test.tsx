import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import type { Finding } from '@/schemas/research-findings';
import { FindingCard } from './FindingCard';

const finding: Finding = {
  dimension: 'MARKET',
  statement: 'Demand for ops tooling grew through 2026.',
  evidence: 'Search interest rose 40% year over year.',
  sourceUrl: 'https://example.test/state-of-ops',
  sourceTitle: 'State of Ops 2026',
  confidence: 'MEDIUM',
  target: 'TREND',
};

describe('FindingCard', () => {
  it('shows the claim, the quote and where it came from', () => {
    renderWithProviders(<FindingCard finding={finding} />);

    expect(screen.getByText(/Demand for ops tooling/)).toBeInTheDocument();
    expect(screen.getByText(/Search interest rose 40%/)).toBeInTheDocument();
    // The domain is visible as text, not only inside href: the founder decides
    // whether to click a model-chosen link by seeing where it goes.
    expect(screen.getByText('example.test')).toBeInTheDocument();
  });

  it('opens the source safely in a new tab', () => {
    renderWithProviders(<FindingCard finding={finding} />);

    const link = screen.getByRole('link', { name: /State of Ops 2026/ });
    expect(link).toHaveAttribute('href', 'https://example.test/state-of-ops');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
  });

  // O card não decide nada: quem sabe se este achado já está no contexto é o
  // deck, que pergunta ao servidor. Um checkbox aqui teria de adivinhar.
  it('renders the actions it was handed, and nothing else', async () => {
    const onClick = vi.fn();
    renderWithProviders(
      <FindingCard finding={finding} footer={<button onClick={onClick}>Guardar este</button>} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Guardar este' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('degrades to a link without a domain label when the source url cannot be parsed', () => {
    const unparseable: Finding = { ...finding, sourceUrl: 'not-a-url' };
    renderWithProviders(<FindingCard finding={unparseable} />);

    const link = screen.getByRole('link', { name: /State of Ops 2026/ });
    expect(link).toHaveAttribute('href', 'not-a-url');
    expect(screen.queryByText('example.test')).not.toBeInTheDocument();
  });

  // The parser deliberately does not re-validate the url, so a scheme the
  // backend refuses today can still arrive from a row stored before that guard
  // existed. React's href rewriting would neuter it, but that is an accident of
  // the renderer rather than a decision this component made.
  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox("x")'])(
    'refuses to link a source with the non-web scheme %s',
    (sourceUrl) => {
      renderWithProviders(
        <FindingCard finding={{ ...finding, sourceUrl }} />,
      );

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      // The finding is not hidden — the founder still reads the claim, the
      // quote and the title of the page they came from.
      expect(screen.getByText('State of Ops 2026')).toBeInTheDocument();
      expect(screen.getByText(/Demand for ops tooling/)).toBeInTheDocument();
    },
  );

  it('still links an ordinary https source with its safe-window attributes', () => {
    renderWithProviders(<FindingCard finding={finding} />);

    const link = screen.getByRole('link', { name: /State of Ops 2026/ });
    expect(link).toHaveAttribute('href', 'https://example.test/state-of-ops');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('example.test')).toBeInTheDocument();
  });

  it('renders the competitor profile for a competitor finding', () => {
    const competitorFinding: Finding = {
      ...finding,
      target: 'COMPETITOR',
      competitor: {
        name: 'Acme Ops',
        positioning: 'Premium, high-touch onboarding.',
        strengths: ['Strong brand recognition'],
        weaknesses: ['Slow support response'],
      },
    };
    renderWithProviders(
      <FindingCard finding={competitorFinding} />,
    );

    expect(screen.getByText('Acme Ops')).toBeInTheDocument();
    expect(screen.getByText('Premium, high-touch onboarding.')).toBeInTheDocument();
    expect(screen.getByText('Strong brand recognition')).toBeInTheDocument();
    expect(screen.getByText('Slow support response')).toBeInTheDocument();
  });
});
