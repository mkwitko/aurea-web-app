import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { ExperimentsPanel } from '@/components/growth/ExperimentsPanel';
import { Help } from '../components/Help';
import { PageHeader } from '../components/PageHeader';
import { LoopRail } from '../components/LoopRail';
import { Button } from '@/components/ui/button';

/**
 * Advanced-mode-only wrapper: the actual list lives in `ExperimentsPanel`,
 * reused by GrowthPage's "experiments" stage. In simple mode `<ListRoute>`
 * never renders this — it redirects `/app/experiments` to
 * `/app/growth/experiments` instead.
 */
export function ExperimentsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <LoopRail />
      <PageHeader
        eyebrow={t('app.nav.experiments')}
        title={t('pages.experiments.title')}
        help={<Help title={t('pages.experiments.helpTitle')}>{t('pages.experiments.help')}</Help>}
        subtitle={t('pages.experiments.subtitle')}
        right={
          <Button asChild>
            <Link to="/app/experiments/new">
              <Plus className="size-4" /> {t('crud.new')}
            </Link>
          </Button>
        }
      />
      <ExperimentsPanel />
    </div>
  );
}
