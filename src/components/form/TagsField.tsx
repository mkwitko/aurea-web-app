import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorAria, Field, type FieldProps } from './Field';

export type TagsFieldProps = Omit<FieldProps, 'children'> & {
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  placeholder?: string;
  addLabel: string;
  removeLabel: (tag: string) => string;
};

/**
 * Lista de strings livres. O rascunho do input é estado interno — é texto ainda
 * não commitado, não o valor do campo. O valor em si vem sempre de `value`.
 */
export function TagsField({
  value,
  onChange,
  placeholder,
  addLabel,
  removeLabel,
  ...field
}: TagsFieldProps) {
  const [draft, setDraft] = useState('');
  const tags = value ?? [];

  const commit = () => {
    const next = draft.trim();
    setDraft('');
    if (!next || tags.includes(next)) return;
    onChange([...tags, next]);
  };

  return (
    <Field {...field}>
      <div className="space-y-2">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                {tag}
                <button
                  type="button"
                  aria-label={removeLabel(tag)}
                  className="rounded-full text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onChange(tags.filter((t) => t !== tag))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            id={field.htmlFor}
            value={draft}
            placeholder={placeholder}
            {...errorAria(field.htmlFor, field.error)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              // Enter aqui adiciona uma tag; não deve submeter o form ao redor.
              e.preventDefault();
              commit();
            }}
          />
          <Button type="button" variant="outline" onClick={commit}>
            {addLabel}
          </Button>
        </div>
      </div>
    </Field>
  );
}
