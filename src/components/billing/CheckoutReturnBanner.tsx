import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Info, Loader2 } from 'lucide-react';
import { useSyncBilling } from '@/api/generated/hooks/billingHooks/useSyncBilling';
import { BILLING, CREDITS } from '@/api/modules';
import { Button } from '@/components/ui/button';

type Outcome = 'idle' | 'confirming' | 'confirmed' | 'pending' | 'canceled';

/** How long the confirmation spinner is allowed to run before giving up on it. */
const SYNC_TIMEOUT_MS = 15_000;

/**
 * Reconciles a return from Stripe Checkout.
 *
 * The redirect can beat the webhook, so a successful checkout calls
 * `POST /billing/sync` — idempotent, it runs the same handlers as the
 * webhook, so this can never double-credit — and then invalidates plan,
 * credits and the ledger. A failing sync is never reported as a failed
 * payment: the money may well be in, so it offers a refresh instead.
 */
export function CheckoutReturnBanner() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // `checkout` only matters at the instant Stripe redirects back here: it is
  // captured once, lazily, from the URL this component mounted with. Every
  // later render reads it from this state rather than re-reading
  // `searchParams`, so dropping the param below (which changes
  // `searchParams`) can never be mistaken for a fresh arrival.
  const [checkoutAtArrival] = useState(() => searchParams.get('checkout'));
  const [outcome, setOutcome] = useState<Outcome>(
    checkoutAtArrival === 'success' ? 'confirming' : checkoutAtArrival === 'cancel' ? 'canceled' : 'idle',
  );

  // `setSearchParams` and `sync.mutate` below are both recreated by their
  // owning libraries, so the effect that uses them can legitimately fire
  // more than once even though nothing about the arrival changed. This ref
  // is what turns that into "acts once per arrival": every entry after the
  // first — including React 18 StrictMode's deliberate double-invoke of a
  // fresh effect — is a no-op, without needing to hide any dependency from
  // the effect's own list.
  const arrived = useRef(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: BILLING.queryKeyRoot });
    void queryClient.invalidateQueries({ queryKey: CREDITS.queryKeyRoot });
    void queryClient.invalidateQueries({ queryKey: CREDITS.ledgerQueryKeyRoot });
  };

  const sync = useSyncBilling({
    mutation: {
      onSuccess: () => {
        invalidate();
        setOutcome('confirmed');
      },
      onError: () => setOutcome('pending'),
    },
  });

  useEffect(() => {
    if (checkoutAtArrival === null || arrived.current) return;
    arrived.current = true;

    // Drop `checkout` from the URL so a reload doesn't replay the return —
    // the state captured above is what keeps the message on screen once the
    // param is gone.
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('checkout');
        return next;
      },
      { replace: true },
    );

    if (checkoutAtArrival === 'success') sync.mutate();
  }, [checkoutAtArrival, setSearchParams, sync.mutate]);

  // Um sync que pendura (proxy que engole a resposta, aba adormecida) deixava
  // este banner girando para sempre — logo depois de pagar, que é o pior lugar
  // para um spinner sem fim. Passado o limite, cai no mesmo estado do erro:
  // "pagamento recebido, atualize". A requisição não é abortada de propósito —
  // POST /billing/sync é idempotente e pode terminar depois, e aí o onSuccess
  // acima troca a mensagem pela confirmação de verdade.
  useEffect(() => {
    if (outcome !== 'confirming') return;
    const timer = setTimeout(() => setOutcome('pending'), SYNC_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [outcome]);

  if (outcome === 'idle') return null;

  const tone =
    outcome === 'confirmed'
      ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
      : outcome === 'pending'
        ? 'border-amber-500/40 text-amber-700 dark:text-amber-300'
        : 'border-border text-muted-foreground';

  return (
    <div role="status" className={`mb-6 flex items-center gap-3 rounded-lg border bg-card/60 px-4 py-3 text-sm ${tone}`}>
      {outcome === 'confirming' && <Loader2 className="size-4 shrink-0 animate-spin" />}
      {outcome === 'confirmed' && <CheckCircle2 className="size-4 shrink-0" />}
      {(outcome === 'pending' || outcome === 'canceled') && <Info className="size-4 shrink-0" />}

      <span>
        {outcome === 'confirming' && t('pages.billing.return.confirming')}
        {outcome === 'confirmed' && t('pages.billing.return.confirmed')}
        {outcome === 'pending' && t('pages.billing.return.pending')}
        {outcome === 'canceled' && t('pages.billing.return.canceled')}
      </span>

      {outcome === 'pending' && (
        <Button size="sm" variant="outline" className="ml-auto" onClick={invalidate}>
          {t('pages.billing.return.refresh')}
        </Button>
      )}
    </div>
  );
}
