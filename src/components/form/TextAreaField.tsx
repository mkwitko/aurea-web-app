import { Textarea } from '@/components/ui/textarea';
import { Field, errorAria } from './Field';
import type { ValueFieldProps } from './TextField';
import { CharCount } from './CharCount';

export function TextAreaField({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
  ...field
}: Omit<ValueFieldProps, 'type'> & { rows?: number }) {
  return (
    <Field {...field} counter={maxLength ? <CharCount value={value} max={maxLength} /> : undefined}>
      <Textarea
        id={field.htmlFor}
        rows={rows}
        value={value ?? ''}
        placeholder={placeholder}
        maxLength={maxLength}
        {...errorAria(field.htmlFor, field.error)}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
