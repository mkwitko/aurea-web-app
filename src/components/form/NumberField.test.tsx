import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumberField } from './NumberField';

describe('NumberField', () => {
  it('renders an undefined value as empty', () => {
    render(<NumberField htmlFor="mrr" label="MRR" value={undefined} onChange={() => {}} />);
    expect(screen.getByLabelText('MRR')).toHaveValue(null);
  });

  it('emits a number when digits are typed, exactly once per keystroke', async () => {
    const onChange = vi.fn();
    render(<NumberField htmlFor="mrr" label="MRR" value={undefined} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('MRR'), '7');
    expect(onChange).toHaveBeenCalledWith(7);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('emits undefined — not NaN, not 0 — when the field is cleared, exactly once', async () => {
    const onChange = vi.fn();
    render(<NumberField htmlFor="mrr" label="MRR" value={9} onChange={onChange} />);
    await userEvent.clear(screen.getByLabelText('MRR'));
    expect(onChange).toHaveBeenCalledWith(undefined);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('emits undefined for a value that is not a finite number', async () => {
    const onChange = vi.fn();
    render(<NumberField htmlFor="mrr" label="MRR" value={undefined} onChange={onChange} />);
    // input[type=number] aceita "-" e "e" como entrada parcial não-numérica
    await userEvent.type(screen.getByLabelText('MRR'), '-');
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('forwards min, max and step to the input', () => {
    render(
      <NumberField
        htmlFor="year"
        label="Ano"
        value={2020}
        onChange={() => {}}
        min={1900}
        max={2099}
        step={1}
      />,
    );
    const el = screen.getByLabelText('Ano');
    expect(el).toHaveAttribute('min', '1900');
    expect(el).toHaveAttribute('max', '2099');
    expect(el).toHaveAttribute('step', '1');
  });

  it('aceita step="any" para medições decimais', () => {
    // Sem isso o passo default é 1 e o browser recusa 9,5 na submissão — uma
    // taxa de conversão medida não é inteira.
    render(<NumberField htmlFor="rate" label="Taxa" value={9.5} onChange={() => {}} step="any" />);

    expect(screen.getByLabelText('Taxa')).toHaveAttribute('step', 'any');
  });
});
