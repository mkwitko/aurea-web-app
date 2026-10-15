import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { CurrencyField } from './CurrencyField';

// pt-BR é a língua default do app, então o separador esperado é o ponto.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'pt-BR' } }),
}));

/** Controlado de verdade: a máscara só aparece quando o valor volta do estado. */
function Harness({ initial }: { initial?: number }) {
  const [value, setValue] = useState<number | undefined>(initial);
  return <CurrencyField htmlFor="tam" label="TAM" value={value} onChange={setValue} />;
}

describe('CurrencyField', () => {
  it('agrupa milhares enquanto o usuário digita e emite número puro', async () => {
    const onChange = vi.fn();
    render(<CurrencyField htmlFor="tam" label="TAM" value={undefined} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText('TAM'), '2');

    // O formulário recebe number, não a string mascarada: a máscara é só
    // apresentação, e um "29.500" chegando ao PUT seria NaN no backend.
    expect(onChange).toHaveBeenLastCalledWith(2);
  });

  it('mostra o valor já mascarado', () => {
    render(<CurrencyField htmlFor="tam" label="TAM" value={29500000000} onChange={() => undefined} />);

    expect(screen.getByLabelText('TAM')).toHaveValue('29.500.000.000');
  });

  it('mascara a cada tecla, sem perder dígito', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('TAM');

    await userEvent.type(input, '29500000000');

    expect(input).toHaveValue('29.500.000.000');
  });

  it('ignora o que não é dígito, incluindo o separador que o usuário digitar', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('TAM');

    await userEvent.type(input, '1.000abc');

    expect(input).toHaveValue('1.000');
  });

  it('volta a undefined quando o campo é apagado — vazio não é zero', async () => {
    const onChange = vi.fn();
    render(<CurrencyField htmlFor="tam" label="TAM" value={1000} onChange={onChange} />);

    await userEvent.clear(screen.getByLabelText('TAM'));

    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('corta em 15 dígitos, o limite do inteiro exato em JS', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('TAM');

    await userEvent.type(input, '12345678901234567890');

    expect(input).toHaveValue('123.456.789.012.345');
  });
});
