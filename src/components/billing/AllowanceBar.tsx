import { useTranslation } from 'react-i18next';
import { allowanceRemaining } from '@/lib/credits';
import { cn } from '@/lib/utils';

/**
 * Consumption of this period's allowance. Consumed can exceed the allowance —
 * a mid-period upgrade grants the difference instead of rewriting the frozen
 * allowance — so the bar clamps instead of overflowing.
 */
export function AllowanceBar({ allowance, consumed }: { allowance: number; consumed: number }) {
  const { t } = useTranslation();
  const shown = Math.min(consumed, allowance);
  const pct = allowance === 0 ? 100 : Math.round((shown / allowance) * 100);
  const exhausted = allowance > 0 && allowanceRemaining({ allowance, consumed }) === 0;

  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={shown}
        aria-valuemin={0}
        aria-valuemax={allowance}
        aria-label={t('pages.billing.allowance.title')}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width]', exhausted ? 'bg-amber-500' : 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-xs text-muted-foreground">
        {t('pages.billing.allowance.used', { consumed, allowance })}
      </p>
      {exhausted && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t('pages.billing.allowance.exhausted')}</p>}
    </div>
  );
}
