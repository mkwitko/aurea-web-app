import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { CreditCard } from 'lucide-react';
import { useGetBilling } from '@/api/generated/hooks/billingHooks/useGetBilling';
import { useGetBillingPlans } from '@/api/generated/hooks/billingHooks/useGetBillingPlans';
import { useCreateSubscriptionCheckout } from '@/api/generated/hooks/billingHooks/useCreateSubscriptionCheckout';
import { useChangeSubscriptionPlan } from '@/api/generated/hooks/billingHooks/useChangeSubscriptionPlan';
import { useCreateBillingPortal } from '@/api/generated/hooks/billingHooks/useCreateBillingPortal';
import type { GetBilling200StatusEnumKey } from '@/api/generated/types/GetBilling';
import { BILLING, CREDITS } from '@/api/modules';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Help } from '@/components/Help';
import { useAuth } from '@/lib/auth';
import { canManageSubscription } from '@/lib/roles';
import { isNotConfigured } from '@/lib/billing-errors';
import { isSubscriptionLive } from '@/lib/subscription';
import { PlanCard } from './PlanCard';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';

type Status = GetBilling200StatusEnumKey;

const statusVariant: Record<Status, 'default' | 'success' | 'muted'> = {
  TRIAL: 'default',
  ACTIVE: 'success',
  PAST_DUE: 'default',
  CANCELED: 'muted',
};

const NOTICE: Partial<Record<Status, string>> = {
  TRIAL: 'pages.billing.trialNotice',
  PAST_DUE: 'pages.billing.pastDueNotice',
  CANCELED: 'pages.billing.canceledNotice',
};

/** Whichever action-result message is currently showing, if any. */
type ActionMessage = 'notConfigured' | 'failed' | 'planChanged' | null;

export function PlanSection() {
  const { t, i18n } = useTranslation();
  const { role } = useAuth();
  const canManage = canManageSubscription(role);
  const [actionMessage, setActionMessage] = useState<ActionMessage>(null);
  const queryClient = useQueryClient();

  const billing = useGetBilling();
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
  // Whatever the last action said is about the last action. Left on screen it
  // describes the one now in flight: a stale "Plan changed." reads as if the
  // new plan were already applied, and a stale failure makes a running retry
  // look like it had already failed.
  const onMutate = () => setActionMessage(null);

  const checkout = useCreateSubscriptionCheckout({
    mutation: { onMutate, onSuccess: (data) => goTo(data.url), onError },
  });
  // Uma assinatura viva troca de plano com `subscriptions.update` e proração —
  // Checkout em modo subscription só CRIA assinatura, e usá-lo aqui deixaria a
  // organização pagando duas. O backend aplica a troca antes de responder, então
  // não há redirect: o que sobra é invalidar o que a troca acabou de mudar.
  const changePlan = useChangeSubscriptionPlan({
    mutation: {
      onMutate,
      onSuccess: () => {
        setActionMessage('planChanged');
        void queryClient.invalidateQueries({ queryKey: BILLING.queryKeyRoot });
        // Um upgrade no meio do período lança o delta da franquia na hora, então
        // o saldo e o extrato ficam velhos junto com o plano.
        void queryClient.invalidateQueries({ queryKey: CREDITS.queryKeyRoot });
        void queryClient.invalidateQueries({ queryKey: CREDITS.ledgerQueryKeyRoot });
      },
      onError,
    },
  });
  const portal = useCreateBillingPortal({
    mutation: { onMutate, onSuccess: (data) => goTo(data.url), onError },
  });

  if (billing.isLoading || catalog.isLoading) return <SectionLoading />;

  if (billing.isError || catalog.isError || !billing.data || !catalog.data) {
    return <SectionLoadError refetch={[billing.refetch, catalog.refetch]} />;
  }

  const state = billing.data;
  const status = state.status;
  // TRIAL e CANCELED não têm assinatura que o Stripe esteja cobrando (CANCELED
  // mantém o stripeSubscriptionId, por isso `hasSubscription` não serve aqui):
  // escolher um plano nesses estados é criar assinatura via Checkout.
  const canSwitch = isSubscriptionLive(status);
  const notice = NOTICE[status];
  const renewal = state.currentPeriodEnd
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(state.currentPeriodEnd))
    : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-xl font-bold">
          {t('pages.billing.plans.title')}
          <Help title={t('pages.billing.plans.helpTitle')}>{t('pages.billing.plans.help')}</Help>
        </h2>
        <Badge variant={statusVariant[status]}>{t(`pages.billing.status.${status}`)}</Badge>
        {renewal && status === 'ACTIVE' && (
          <span className="font-mono text-xs text-muted-foreground">{t('pages.billing.renewsOn', { date: renewal })}</span>
        )}
        <div className="ml-auto flex items-center">
          <Button variant="outline" size="sm" disabled={!canManage || portal.isPending} onClick={() => portal.mutate()}>
            <CreditCard className="size-4" /> {t('pages.billing.portal')}
          </Button>
          {canManage ? (
            <Help title={t('pages.billing.portalHelpTitle')}>{t('pages.billing.portalHelp')}</Help>
          ) : (
            <Help title={t('pages.billing.plans.ownerOnlyHelpTitle')}>{t('pages.billing.plans.ownerOnly')}</Help>
          )}
        </div>
      </div>

      {notice && <p className="text-sm text-muted-foreground">{t(notice)}</p>}
      {actionMessage === 'notConfigured' && (
        <p className="text-sm text-amber-600 dark:text-amber-400">{t('pages.billing.notConfigured')}</p>
      )}
      {actionMessage === 'failed' && (
        <p className="text-sm text-destructive">{t('pages.billing.actionFailed')}</p>
      )}
      {actionMessage === 'planChanged' && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{t('pages.billing.plans.changed')}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {catalog.data.plans.map((entry) => (
          <PlanCard
            key={entry.plan}
            plan={entry.plan}
            monthlyCredits={entry.monthlyCredits}
            maxWorkspaces={entry.maxWorkspaces}
            priceCents={entry.priceCents}
            currency={entry.currency}
            // `Organization.plan` tem default STARTER e a coluna guarda o último
            // plano depois do cancelamento, então plano corrente sem assinatura
            // viva é ruído: dizer "plano atual" para quem está em TRIAL vende um
            // plano que ninguém assinou — e esconde a ação daquele card, que é
            // justamente a de assinar.
            isCurrent={canSwitch && entry.plan === state.plan}
            canSwitch={canSwitch}
            canManage={canManage}
            pending={checkout.isPending || changePlan.isPending}
            onChoose={(plan) =>
              canSwitch ? changePlan.mutate({ data: { plan } }) : checkout.mutate({ data: { plan } })
            }
          />
        ))}
      </div>
    </section>
  );
}
