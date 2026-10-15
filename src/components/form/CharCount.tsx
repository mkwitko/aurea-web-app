import { cn } from '@/lib/utils';

export interface CharCountProps {
  value: string | undefined;
  /** Mesmo teto do schema do campo, que por sua vez é o teto da API. */
  max: number;
}

/**
 * "312 / 2000" ao lado do campo. Fica vermelho quando passa do teto — o que só
 * acontece com valor que não veio do teclado (uma proposta da IA, um valor já
 * gravado), porque o próprio controle recusa digitação além do limite.
 */
export function CharCount({ value, max }: CharCountProps) {
  const count = value?.length ?? 0;
  return (
    <p className={cn('text-xs tabular-nums', count > max ? 'text-destructive' : 'text-muted-foreground')}>
      {count} / {max}
    </p>
  );
}
