import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

function Harness({ onValueChange }: { onValueChange?: (v: string) => void }) {
  return (
    <Select onValueChange={onValueChange}>
      <SelectTrigger id="stage" aria-label="Estágio">
        <SelectValue placeholder="Selecione" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="seed">Seed</SelectItem>
        <SelectItem value="series-a">Série A</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('shows the placeholder when no value is selected', () => {
    render(<Harness />);
    expect(screen.getByText('Selecione')).toBeInTheDocument();
  });

  it('reports the chosen value', async () => {
    const onValueChange = vi.fn();
    render(<Harness onValueChange={onValueChange} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Estágio' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Série A' }));

    expect(onValueChange).toHaveBeenCalledWith('series-a');
  });
});
