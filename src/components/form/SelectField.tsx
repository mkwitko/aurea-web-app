import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EnumOption } from '@/lib/enums';
import { errorAria, Field, type FieldProps } from './Field';

/** O Radix rejeita SelectItem com value="". Sentinela interna para "sem valor". */
const CLEAR = '__clear__';

export type SelectFieldProps<T extends string> = Omit<FieldProps, 'children'> & {
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: readonly EnumOption<T>[];
  placeholder?: string;
  /** Texto da opção que limpa o campo. Omitir torna o campo não-limpável. */
  clearLabel?: string;
  /** Tradutor injetado — a primitiva não depende de provider de i18n. */
  translate: (key: string) => string;
};

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  placeholder,
  clearLabel,
  translate,
  ...field
}: SelectFieldProps<T>) {
  return (
    <Field {...field}>
      <Select
        value={value ?? ''}
        onValueChange={(next) => onChange(next === CLEAR ? undefined : (next as T))}
      >
        <SelectTrigger id={field.htmlFor} {...errorAria(field.htmlFor, field.error)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {clearLabel && <SelectItem value={CLEAR}>{clearLabel}</SelectItem>}
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {translate(o.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
