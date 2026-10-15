import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useListStrategies } from '@/api/generated/hooks/strategiesHooks/useListStrategies';
import { ProposeStrategies } from '@/components/strategies/ProposeStrategies';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/** The strategy proposer + list, shared by the standalone page and GrowthPage. */
export function StrategiesPanel() {
  const { t } = useTranslation();
  const { data, isLoading } = useListStrategies();
  const strategies = data?.strategies ?? [];

  return (
    <div>
      <div className="mb-4">
        <ProposeStrategies />
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
        </p>
      ) : (
        <div className="space-y-3">
          {strategies.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">{t('pages.strategies.empty')}</CardContent>
            </Card>
          )}
          {strategies.map((s) => (
            <Card key={s.id} className="card-tech">
              <CardContent className="p-5">
                <Link to={`/app/strategies/${s.id}`} className="flex items-center gap-2 font-medium">
                  <span className="truncate">{s.name}</span>
                  <Badge variant="muted">{t(`status.${s.status}`)}</Badge>
                </Link>
                {s.growthMechanism && (
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {t('pages.strategies.mechanismLabel')}: {s.growthMechanism}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
