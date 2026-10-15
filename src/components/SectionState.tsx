import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** Placeholder while a section's queries load for the first time. */
export function SectionLoading() {
  const { t } = useTranslation();

  return (
    <div aria-busy className="space-y-3">
      <span className="sr-only flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
      </span>
      <div aria-hidden className="h-24 animate-pulse rounded-xl bg-muted/70" />
      <div aria-hidden className="h-24 animate-pulse rounded-xl bg-muted/40" />
    </div>
  );
}

/**
 * Error card for a section that has nothing to show yet.
 *
 * Every query the section needs has to be listed in `refetch`: retrying only
 * the first one leaves a failed sibling errored forever, with the section stuck
 * on this card — the exact bug the duplicated copies of it had. They run in
 * parallel because they are independent, and chaining them made the user wait
 * for the sum of them while looking at an error.
 */
export function SectionLoadError({ refetch }: { refetch: Array<() => Promise<unknown>> }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-5 text-sm text-muted-foreground">
        {t('common.loadError')}
        <Button size="sm" variant="outline" onClick={() => void Promise.all(refetch.map((run) => run()))}>
          {t('common.retry')}
        </Button>
      </CardContent>
    </Card>
  );
}
