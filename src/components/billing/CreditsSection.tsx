import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetCredits } from '@/api/generated/hooks/creditsHooks/useGetCredits';
import { useGetBillingPlans } from '@/api/generated/hooks/billingHooks/useGetBillingPlans';
import { useCreateCreditPackCheckout } from '@/api/generated/hooks/billingHooks/useCreateCreditPackCheckout';
import type { PacksPackIdEnumKey } from '@/api/generated/types/GetBillingPlans';
import { Card, CardContent } from '@/components/ui/card';
import { Help } from '@/components/Help';
import { useAuth } from '@/lib/auth';
import { canBuyCredits } from '@/lib/roles';
import { availableCredits } from '@/lib/credits';
import { isNotConfigured } from '@/lib/billing-errors';
import { cn } from '@/lib/utils';
import { AllowanceBar } from './AllowanceBar';
import { CreditPackCard } from './CreditPackCard';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';

/** Whichever action-result message is currently showing, if any. */
type ActionMessage = 'notConfigured' | 'failed' | null;

export function CreditsSection() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const canBuy = canBuyCredits(role);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);

  const credits = useGetCredits();
  const catalog = useGetBillingPlans();

  // O redirect tem que ser na mesma aba: o Stripe volta pelo RETURN_PATH e uma
  // aba nova perderia o retorno que reconcilia o pagamento.
  const goTo = (url: string) => {
    setActionMessage(null);
    window.location.assign(url);
  };
  // AUR-T0016 (BILLING_NOT_CONFIGURED) is an operator problem, not a user
  // error, so it gets its own message; anything else (a declined card, a
  // network blip, a plain 500) still needs to tell the user *something*
  // rather than just silently re-enabling the button.
  const onError = (error: unknown) => setActionMessage(isNotConfigured(error) ? 'notConfigured' : 'failed');
  // Whatever the last action said is about the last action: a failure left on
  // screen under a running retry says the retry has already failed too.
  const onMutate = () => setActionMessage(null);

  const checkout = useCreateCreditPackCheckout({
    mutation: { onMutate, onSuccess: (data) => goTo(data.url), onError },
  });

  if (credits.isLoading || catalog.isLoading) return <SectionLoading />;

  if (credits.isError || catalog.isError || !credits.data || !catalog.data) {
    return <SectionLoadError refetch={[credits.refetch, catalog.refetch]} />;
  }

  const state = credits.data;
  const hasAllowance = state.allowance > 0;

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold">
        {t('pages.billing.credits.title')}
        <Help title={t('pages.billing.credits.helpTitle')}>{t('pages.billing.credits.help')}</Help>
      </h2>

      <div className={cn('grid gap-4', hasAllowance ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        {/* Franquia zero (TRIAL, CANCELED) não tem barra: uma barra de 0 de 0
            desenhava 100% de largura e lia como franquia cheia. Quem não assina
            tem o grant de boas-vindas e o crédito comprado, que estão ao lado. */}
        {hasAllowance && (
          <Card className="sm:col-span-2">
            <CardContent className="p-5">
              <p className="mb-3 text-sm font-medium">
                {t('pages.billing.allowance.title')}
                <Help title={t('pages.billing.allowance.helpTitle')}>{t('pages.billing.allowance.help')}</Help>
              </p>
              <AllowanceBar allowance={state.allowance} consumed={state.consumed} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="text-sm font-medium">
                {t('pages.billing.credits.purchased')}
                <Help title={t('pages.billing.packs.helpTitle')}>{t('pages.billing.packs.help')}</Help>
              </p>
              <p className="font-display text-2xl font-extrabold">{state.purchasedBalance}</p>
            </div>
            <div>
              <p className="text-sm font-medium">{t('pages.billing.credits.available')}</p>
              <p className="font-display text-2xl font-extrabold text-primary">{availableCredits(state)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fora dos cards: a franquia pode não estar na tela, e o aviso de escopo
          vale para os dois números do lado (o saldo também é do workspace). */}
      <p className="text-xs text-muted-foreground">{t('pages.billing.credits.workspaceScope')}</p>

      <h3 className="pt-2 font-display text-lg font-bold">{t('pages.billing.packs.title')}</h3>
      {actionMessage === 'notConfigured' && (
        <p className="text-sm text-amber-600 dark:text-amber-400">{t('pages.billing.notConfigured')}</p>
      )}
      {actionMessage === 'failed' && <p className="text-sm text-destructive">{t('pages.billing.actionFailed')}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {catalog.data.packs.map((pack) => (
          <CreditPackCard
            key={pack.packId}
            packId={pack.packId}
            credits={pack.credits}
            priceCents={pack.priceCents}
            currency={pack.currency}
            canBuy={canBuy}
            pending={checkout.isPending}
            onBuy={(packId: PacksPackIdEnumKey) => checkout.mutate({ data: { packId } })}
          />
        ))}
      </div>
    </section>
  );
}
