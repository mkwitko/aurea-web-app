import { useTranslation } from 'react-i18next';
import { useListIcps } from '@/api/generated/hooks/icpsHooks/useListIcps';
import { SectionLoading } from '@/components/SectionState';
import { Card, CardContent } from '@/components/ui/card';

/** The ICP card grid, shared by the standalone list page and the business tab. */
export function IcpsPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useListIcps();
  const icps = data?.icps ?? [];

  if (isLoading) return <SectionLoading />;

  if (icps.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">{t('pages.icps.empty')}</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {icps.map((icp) => (
        <Card key={icp.id} className="card-tech">
          <CardContent className="p-5">
            <div className="font-medium">{icp.name}</div>
            {icp.description && <div className="mt-0.5 text-sm text-muted-foreground">{icp.description}</div>}
            {icp.painPoints && icp.painPoints.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {icp.painPoints.map((p) => (
                  <span key={p} className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {p}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
