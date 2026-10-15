import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField } from './SelectField';

const OPTIONS = [
  { value: 'seed', labelKey: 'Seed' },
  { value: 'series-a', labelKey: 'Série A' },
] as const;

describe('SelectField', () => {
  it('renders the placeholder when the value is undefined', () => {
    render(
      <SelectField
        htmlFor="stage"
        label="Estágio"
        value={undefined}
        onChange={() => {}}
        options={OPTIONS}
        placeholder="Selecione"
        translate={(k) => k}
      />,
    );
    expect(screen.getByText('Selecione')).toBeInTheDocument();
  });

  it('emits the selected value', async () => {
    const onChange = vi.fn();
    render(
      <SelectField
        htmlFor="stage"
        label="Estágio"
        value={undefined}
        onChange={onChange}
        options={OPTIONS}
        translate={(k) => k}
      />,
    );
    await userEvent.click(screen.getByLabelText('Estágio'));
    await userEvent.click(await screen.findByRole('option', { name: 'Série A' }));
    expect(onChange).toHaveBeenCalledWith('series-a');
  });

  it('emits undefined when the clear option is chosen', async () => {
    const onChange = vi.fn();
    render(
      <SelectField
        htmlFor="stage"
        label="Estágio"
        value="seed"
        onChange={onChange}
        options={OPTIONS}
        clearLabel="—"
        translate={(k) => k}
      />,
    );
    await userEvent.click(screen.getByLabelText('Estágio'));
    await userEvent.click(await screen.findByRole('option', { name: '—' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('does not render a clear option when clearLabel is omitted', async () => {
    render(
      <SelectField
        htmlFor="stage"
        label="Estágio"
        value="seed"
        onChange={() => {}}
        options={OPTIONS}
        translate={(k) => k}
      />,
    );
    await userEvent.click(screen.getByLabelText('Estágio'));
    expect(await screen.findAllByRole('option')).toHaveLength(2);
  });
});
