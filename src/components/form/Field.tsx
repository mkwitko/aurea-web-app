import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Help } from '@/components/Help';

export interface FieldProps {
  /** id do controle que este campo rotula. Também deriva o id do erro. */
  htmlFor: string;
  label: string;
  /** Explicação in-app do termo de domínio (regra 2 de CLAUDE.md). */
  help?: ReactNode;
  helpTitle?: string;
  optional?: boolean;
  /** Texto traduzido de "opcional". O Field não traduz nada por conta própria. */
  optionalLabel?: string;
  error?: string;
  /** Contador de caracteres; ocupa a direita da mesma linha do erro. */
  counter?: ReactNode;
  children: ReactNode;
}

/**
 * Aria attributes that point a control at the error paragraph `Field` renders
 * for the same `htmlFor`. Returns nothing when there is no error, so the
 * attributes are absent rather than stringified "undefined".
 */
export function errorAria(htmlFor: string, error: string | undefined) {
  return error ? { 'aria-describedby': `${htmlFor}-error`, 'aria-invalid': true as const } : {};
}

/**
 * Layout de um campo de formulário: rótulo, explicação, marca de opcional e erro.
 * Não guarda estado e não sabe que tipo de controle envolve.
 */
export function Field({
  htmlFor,
  label,
  help,
  helpTitle,
  optional,
  optionalLabel,
  error,
  counter,
  children,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {help && <Help title={helpTitle}>{help}</Help>}
        {optional && optionalLabel && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">{optionalLabel}</span>
        )}
      </Label>
      {children}
      {(error || counter) && (
        <div className="flex items-start justify-between gap-3">
          {error ? (
            <p id={`${htmlFor}-error`} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <span />
          )}
          {counter}
        </div>
      )}
    </div>
  );
}
