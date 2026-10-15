import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Help } from '@/components/Help';
import { formatCents } from '@/lib/money';

type PackId = 'SMALL' | 'MEDIUM' | 'LARGE';

export function CreditPackCard({
  packId,
  credits,
  priceCents,
  currency,
  canBuy,
  pending,
  onBuy,
}: {
  packId: PackId;
  credits: number;
  priceCents: number;
  currency: string;
  canBuy: boolean;
  pending: boolean;
  onBuy: (packId: PackId) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <Card className="transition-colors duration-150 hover:border-primary/40">
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {t(`enums.pack.${packId}`)}
        </span>
        <span className="font-display text-xl font-bold">{t('pages.billing.packs.credits', { count: credits })}</span>
        <span className="text-sm text-muted-foreground">{formatCents(priceCents, currency, i18n.language)}</span>

        <div className="mt-auto flex items-center">
          <Button className="w-full" variant="outline" disabled={!canBuy || pending} onClick={() => onBuy(packId)}>
            {t('pages.billing.packs.buy')}
          </Button>
          {!canBuy && (
            <Help title={t('pages.billing.packs.adminOnlyHelpTitle')}>{t('pages.billing.packs.adminOnly')}</Help>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
