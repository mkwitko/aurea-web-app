import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

export interface FillErrorCardProps {
  title: string;
  body: string;
  /** Uma linha sobre o crédito: se voltou, ou se este run já foi cobrado. */
  note?: string;
  /**
   * A mensagem crua do runner. Fica dobrada num `details` em vez de fora da
   * tela: é ela que resolve um chamado de suporte, e é ela que ninguém deveria
   * ler primeiro.
   */
  technical?: string | null;
  /** O bloco de gerar de novo — o mesmo do primeiro clique. */
  children: ReactNode;
}

/**
 * O erro de um run de IA, na forma que um fundador consegue usar: o que
 * aconteceu, o que fazer, o que aconteceu com o crédito.
 *
 * Antes eram três cards diferentes com uma linha de texto vermelho e um botão
 * outline solto — sem dizer quanto custa a nova tentativa, quem trabalha nela,
 * nem que o crédito do run que falhou já tinha voltado.
 */
export function FillErrorCard({ title, body, note, technical, children }: FillErrorCardProps) {
  const { t } = useTranslation();

  return (
    <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{body}</p>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>

      {children}

      {technical && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">{t('ai.fill.error.details')}</summary>
          <p className="mt-1 break-words font-mono">{technical}</p>
        </details>
      )}
    </div>
  );
}
