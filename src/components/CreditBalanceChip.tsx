import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Coins } from 'lucide-react';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { availableCredits } from '@/lib/credits';

/**
 * Spendable balance, always visible in the shell: agents spend credits from
 * every screen, so the number cannot live only on the billing page. Renders
 * nothing while loading or on error — a failing credits call must not break
 * the shell.
 */
export function CreditBalanceChip() {
  const { t } = useTranslation();
  const { data, isError } = useGetCredits();

  if (isError || !data) return null;

  return (
    <Link
      to="/app/settings/billing"
      aria-label={t('app.creditsChipLabel')}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Coins className="size-3.5 text-aura" />
      {t('app.creditsChip', { count: availableCredits(data) })}
    </Link>
  );
}
