import { Input } from '@/components/ui/input';
import { Field, type FieldProps, errorAria } from './Field';
import { CharCount } from './CharCount';

export type ValueFieldProps = Omit<FieldProps, 'children' | 'counter'> & {
  value: string | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Só o TextField usa. `date` para as datas do domínio, `url` para website e competitor.url. */
  // `password` existe por causa da senha de app do Bluesky: ela é digitada numa
  // tela que pode estar sendo compartilhada, e não deve ficar visível.
  type?: 'text' | 'date' | 'url' | 'email' | 'password';
  /** Teto do schema do campo. Limita a digitação e liga o contador. */
  maxLength?: number;
};

export function TextField({ value, onChange, placeholder, type = 'text', maxLength, ...field }: ValueFieldProps) {
  return (
    <Field {...field} counter={maxLength ? <CharCount value={value} max={maxLength} /> : undefined}>
      <Input
        id={field.htmlFor}
        type={type}
        value={value ?? ''}
        placeholder={placeholder}
        maxLength={maxLength}
        {...errorAria(field.htmlFor, field.error)}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
