import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { Help } from '@/components/Help';
import { CheckoutReturnBanner } from '@/components/billing/CheckoutReturnBanner';
import { PlanSection } from '@/components/billing/PlanSection';
import { CreditsSection } from '@/components/billing/CreditsSection';
import { LedgerSection } from '@/components/billing/LedgerSection';

// No `LoopRail` here: billing is a setting, not a stage of the growth loop.
export function BillingPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        eyebrow={t('app.nav.billing')}
        title={t('pages.billing.title')}
        help={<Help title={t('pages.billing.helpTitle')}>{t('pages.billing.help')}</Help>}
        subtitle={t('pages.billing.subtitle')}
      />

      <CheckoutReturnBanner />

      <div className="space-y-10">
        <PlanSection />
        <CreditsSection />
        <LedgerSection />
      </div>
    </div>
  );
}
