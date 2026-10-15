import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useListExperiments } from '@/api/generated/hooks/experimentsHooks/useListExperiments';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

/** The experiment list, shared by the standalone page and GrowthPage. */
export function ExperimentsPanel() {
  const { t } = useTranslation();
  const experiments = useListExperiments();

  if (experiments.isLoading) return <SectionLoading />;
  if (experiments.isError || !experiments.data) return <SectionLoadError refetch={[experiments.refetch]} />;

  if (experiments.data.experiments.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-2 p-8 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t('pages.experiments.empty')}</p>
          {/* Where experiments come from, not just that there are none: an
              experiment always tests a hypothesis, so the way forward is
              through a strategy, not this page's "new" button alone. */}
          <p>{t('pages.experiments.emptyHint')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {experiments.data.experiments.map((experiment) => (
        <Card key={experiment.id} className="transition-colors hover:border-primary/40">
          <CardContent className="p-5">
            <Link to={`/app/experiments/${experiment.id}`} className="flex items-center gap-2 font-medium">
              <span className="truncate">{experiment.name}</span>
              <Badge variant="muted">{t(`status.${experiment.status}`)}</Badge>
            </Link>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {t('pages.experiments.metricLabel')}: {experiment.metric}
              {experiment.targetValue !== null && ` → ${experiment.targetValue}`}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
