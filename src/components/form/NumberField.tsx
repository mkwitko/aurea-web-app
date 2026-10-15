import { Input } from '@/components/ui/input';
import { errorAria, Field, type FieldProps } from './Field';

export type NumberFieldProps = Omit<FieldProps, 'children'> & {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  /** `"any"` libera decimais: com o passo default 1 o browser recusa 9,5 no submit. */
  step?: number | 'any';
};

/**
 * Campo numérico. Único lugar do app que converte string de input em número:
 * vazio e entrada parcial não-numérica ("-", "e") emitem `undefined`, nunca NaN.
 */
export function NumberField({
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  ...field
}: NumberFieldProps) {
  // onInput alone: input[type=number] não dispara `change` de forma confiável
  // no jsdom para entrada parcial não-numérica ("-", "e"). Usar `onChange`
  // também dispararia o mesmo evento nativo duas vezes (React expõe change e
  // input do mesmo evento do DOM), dobrando qualquer efeito encadeado a
  // onChange (validação, autosave, analytics).
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const raw = e.currentTarget.value.trim();
    if (raw === '') return onChange(undefined);
    const parsed = Number(raw);
    onChange(Number.isFinite(parsed) ? parsed : undefined);
  };

  return (
    <Field {...field}>
      <Input
        id={field.htmlFor}
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        {...errorAria(field.htmlFor, field.error)}
        onInput={handleInput}
      />
    </Field>
  );
}
