import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { errorAria, Field, type FieldProps } from './Field';

export type CurrencyFieldProps = Omit<FieldProps, 'children'> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
};

/**
 * 15 dígitos: R$ 999 trilhões cobre qualquer TAM que exista e ainda cabe
 * inteiro em `Number` (o limite seguro tem 16). Sem este corte, colar um
 * número longo produziria um valor que o JS já não representa exatamente.
 */
const MAX_DIGITS = 15;

const digitsOf = (text: string): string => text.replace(/\D/g, '').slice(0, MAX_DIGITS);

/**
 * Valor em dinheiro com separador de milhar, na língua da interface.
 *
 * `input[type=number]` não aceita máscara — o browser recusa qualquer
 * caractere que não componha um número, então "29.500.000.000" é impossível
 * ali. Este campo é `type=text` com `inputMode=numeric`: o teclado numérico do
 * celular continua aparecendo, e o que sai no `onChange` é um `number` como no
 * `NumberField` — a máscara é só de apresentação, nunca chega ao formulário.
 *
 * Só inteiros: os campos de dinheiro do contexto (TAM, SAM, SOM, orçamento,
 * MRR) são ordens de grandeza, e centavo em TAM é ruído.
 */
export function CurrencyField({ value, onChange, placeholder, ...field }: CurrencyFieldProps) {
  const { i18n } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  /** Quantos dígitos ficavam antes do cursor quando o usuário digitou. */
  const caretDigits = useRef<number | null>(null);

  const formatted = value === undefined ? '' : new Intl.NumberFormat(i18n.language).format(value);

  // Reposiciona o cursor depois da máscara: sem isto, digitar no meio de
  // "29.500.000" jogaria o cursor para o fim a cada tecla, porque o valor do
  // input é reescrito inteiro. A âncora é a contagem de dígitos, não o índice
  // de caractere — os pontos entram e saem conforme o número cresce.
  useEffect(() => {
    const element = inputRef.current;
    if (!element || caretDigits.current === null) return;
    const target = caretDigits.current;
    caretDigits.current = null;
    let seen = 0;
    let index = 0;
    while (index < element.value.length && seen < target) {
      if (/\d/.test(element.value.charAt(index))) seen += 1;
      index += 1;
    }
    element.setSelectionRange(index, index);
  }, [formatted]);

  const handleInput = (event: React.FormEvent<HTMLInputElement>) => {
    const element = event.currentTarget;
    const position = element.selectionStart ?? element.value.length;
    caretDigits.current = digitsOf(element.value.slice(0, position)).length;
    const digits = digitsOf(element.value);
    onChange(digits === '' ? undefined : Number(digits));
  };

  return (
    <Field {...field}>
      <Input
        ref={inputRef}
        id={field.htmlFor}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={formatted}
        placeholder={placeholder}
        {...errorAria(field.htmlFor, field.error)}
        onInput={handleInput}
      />
    </Field>
  );
}
