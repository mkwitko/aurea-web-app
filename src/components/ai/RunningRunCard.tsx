import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface RunningRunCardProps {
  /** Quando o run começou. Sem isso, mostra só o spinner: cronômetro chutado mente. */
  startedAt: Date | null;
  /** O run em voo é de outro pedido — outra seção, outro botão. */
  isForeign?: boolean;
  onCancel(): void;
  isCancelling: boolean;
}

function elapsedLabel(from: Date, now: number): string {
  const seconds = Math.max(0, Math.floor((now - from.getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * O run em voo, visível: há quanto tempo roda e como sair dele.
 *
 * Antes desta tela o fundador via um "pensando…" indistinguível de um run
 * morto — e não tinha saída nenhuma, porque a deduplicação do backend devolvia
 * o mesmo run travado a cada nova tentativa. O cronômetro é o que transforma
 * "travou?" em informação, e o cancelar é o que devolve o controle (e o
 * crédito).
 */
export function RunningRunCard({ startedAt, isForeign, onCancel, isCancelling }: RunningRunCardProps) {
  const { t } = useTranslation();
  // Um tick por segundo enquanto o card está montado. O relógio vive aqui, e
  // não no hook do run, para não re-renderizar o formulário inteiro a cada
  // segundo só por causa do cronômetro.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {isForeign ? t('ai.fill.otherRunning') : t('ai.fill.thinking')}
        {startedAt && <span className="tabular-nums">{elapsedLabel(startedAt, now)}</span>}
      </p>
      <Button size="sm" variant="outline" onClick={onCancel} disabled={isCancelling}>
        {t('ai.fill.cancel')}
      </Button>
    </div>
  );
}
