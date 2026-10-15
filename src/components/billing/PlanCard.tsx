import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { PlansPlanEnumKey } from '@/api/generated/types/GetBillingPlans';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Help } from '@/components/Help';
import { formatCents } from '@/lib/money';
import { cn } from '@/lib/utils';

type Plan = PlansPlanEnumKey;

export function PlanCard({
  plan,
  monthlyCredits,
  maxWorkspaces,
  priceCents,
  currency,
  isCurrent,
  canSwitch,
  canManage,
  pending,
  onChoose,
}: {
  plan: Plan;
  monthlyCredits: number;
  maxWorkspaces: number;
  priceCents: number;
  currency: string;
  isCurrent: boolean;
  /**
   * There is a live subscription to move, so choosing this plan switches the
   * existing one in place; without it the choice opens a Stripe Checkout to
   * create a subscription. Drives the label so it matches what the click does.
   */
  canSwitch: boolean;
  canManage: boolean;
  pending: boolean;
  onChoose: (plan: Plan) => void;
}) {
  const { t, i18n } = useTranslation();

  return (
    <Card
      className={cn(
        'transition-colors duration-150 hover:border-primary/40',
        isCurrent && 'ring-1 ring-primary/40',
      )}
    >
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-lg font-bold">{t(`enums.plan.${plan}`)}</span>
          {isCurrent && (
            <Badge variant="success">
              <Check className="mr-1 size-3" /> {t('pages.billing.plans.current')}
            </Badge>
          )}
        </div>

        <div>
          <span className="font-display text-2xl font-extrabold">{formatCents(priceCents, currency, i18n.language)}</span>
          <span className="text-sm text-muted-foreground">{t('pages.billing.plans.perMonth')}</span>
        </div>

        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>{t('pages.billing.plans.creditsPerMonth', { count: monthlyCredits })}</li>
          <li>{t('pages.billing.plans.workspaceCap', { count: maxWorkspaces })}</li>
        </ul>

        {!isCurrent && (
          <div className="mt-auto flex items-center">
            <Button
              className="w-full"
              variant={canSwitch ? 'outline' : 'default'}
              disabled={!canManage || pending}
              onClick={() => onChoose(plan)}
            >
              {canSwitch ? t('pages.billing.plans.switch') : t('pages.billing.plans.subscribe')}
            </Button>
            {!canManage && (
              <Help title={t('pages.billing.plans.ownerOnlyHelpTitle')}>{t('pages.billing.plans.ownerOnly')}</Help>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
