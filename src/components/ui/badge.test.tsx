import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Ativo</Badge>);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('applies the variant class', () => {
    render(<Badge variant="muted">Rascunho</Badge>);
    expect(screen.getByText('Rascunho')).toHaveClass('bg-muted');
  });
});
