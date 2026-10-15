import { render, screen } from '@testing-library/react';
import { CharCount } from './CharCount';

describe('CharCount', () => {
  it('reads "used / limit" and stays muted inside the limit', () => {
    render(<CharCount value="abc" max={10} />);
    const counter = screen.getByText('3 / 10');
    expect(counter).toBeInTheDocument();
    expect(counter.className).toContain('text-muted-foreground');
  });

  it('counts an absent value as zero', () => {
    render(<CharCount value={undefined} max={10} />);
    expect(screen.getByText('0 / 10')).toBeInTheDocument();
  });

  /** Só um valor programático passa do teto — uma proposta da IA, ou um registro antigo. */
  it('turns destructive when the value is over the limit', () => {
    render(<CharCount value={'x'.repeat(11)} max={10} />);
    expect(screen.getByText('11 / 10').className).toContain('text-destructive');
  });
});
