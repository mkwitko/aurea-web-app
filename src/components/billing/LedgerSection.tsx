import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { keepPreviousData } from '@tanstack/react-query';
import { useListCreditLedger } from '@/api/generated/hooks/creditsHooks/useListCreditLedger';
import type { ListCreditLedgerQueryResponse } from '@/api/generated/types/ListCreditLedger';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Help } from '@/components/Help';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';

// Derived from the generated response so the row shape — and the kind union
// below — cannot drift from the contract.
type LedgerEntry = ListCreditLedgerQueryResponse['entries'][number];
type Kind = LedgerEntry['kind'];

const kindVariant: Record<Kind, 'default' | 'success' | 'muted'> = {
  DEBIT: 'muted',
  REFUND: 'default',
  PURCHASE: 'success',
  GRANT: 'success',
};

const PAGE_SIZE = 20;

/** DEBIT takes credits away; every other kind puts them in. */
function signed(kind: Kind, credits: number): string {
  return kind === 'DEBIT' ? `-${credits}` : `+${credits}`;
}

export function LedgerSection() {
  const { t, i18n } = useTranslation();
  // Cursor of the next page to request — the createdAt of the oldest entry
  // seen so far. Undefined means "first page".
  const [beforeCursor, setBeforeCursor] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  const ledger = useListCreditLedger(
    { limit: PAGE_SIZE, ...(beforeCursor ? { before: new Date(beforeCursor) } : {}) },
    {
      // Changing `beforeCursor` switches to a brand-new query key, which
      // TanStack would otherwise leave `data` undefined for until the fetch
      // settles. Keeping the previous page's data visible across that switch
      // is what keeps the "load more" button mounted (so it can show
      // `isFetching`) instead of vanishing the instant it is clicked.
      query: { placeholderData: keepPreviousData },
    },
  );

  // Each cursor is its own query key, so accumulating here is what makes
  // "load more" append instead of replace. Deduplicated by id because a
  // refetch of the first page must not repeat rows, and re-sorted on every
  // merge because the union above does not preserve order.
  useEffect(() => {
    if (!ledger.data) return;
    setEntries((prev) => {
      const byId = new Map(prev.map((entry) => [entry.id, entry]));
      for (const entry of ledger.data.entries) byId.set(entry.id, entry);
      return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }, [ledger.data]);

  // Full reset for the empty-state error card below: there is nothing on
  // screen yet, so retrying means starting over from the first page.
  const retryFirstPage = async () => {
    setBeforeCursor(undefined);
    setEntries([]);
    return ledger.refetch();
  };

  const loadMore = () => {
    const cursor = ledger.data?.nextCursor;
    if (cursor) setBeforeCursor(cursor);
  };

  // Only the very first page has no accumulated rows to fall back on, so
  // loading/error states from a later "load more" leave the existing list on
  // screen instead of tearing it down.
  if (ledger.isLoading && entries.length === 0) return <SectionLoading />;

  if (ledger.isError && entries.length === 0) return <SectionLoadError refetch={[retryFirstPage]} />;

  return (
    <section className="space-y-4">
      <h2 className="font-display text-xl font-bold">
        {t('pages.billing.ledger.title')}
        <Help title={t('pages.billing.ledger.helpTitle')}>{t('pages.billing.ledger.help')}</Help>
      </h2>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t('pages.billing.ledger.empty')}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/70">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={kindVariant[entry.kind]}>{t(`pages.billing.ledger.kind.${entry.kind}`)}</Badge>
                      <span className="truncate text-sm">{entry.reason}</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(
                        new Date(entry.createdAt),
                      )}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono text-sm">{signed(entry.kind, entry.credits)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* A failure on a later page keeps the rows already on screen, so this
          re-fetches the CURRENT cursor (`ledger`'s active query key), not
          page 1. */}
      {ledger.isError ? (
        <SectionLoadError refetch={[ledger.refetch]} />
      ) : (
        ledger.data?.nextCursor && (
          <Button variant="outline" size="sm" disabled={ledger.isFetching} onClick={loadMore}>
            {t('pages.billing.ledger.loadMore')}
          </Button>
        )
      )}
    </section>
  );
}
