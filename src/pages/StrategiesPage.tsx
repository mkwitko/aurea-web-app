import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { StrategiesPanel } from '@/components/growth/StrategiesPanel';
import { Help } from '../components/Help';
import { PageHeader } from '../components/PageHeader';
import { LoopRail } from '../components/LoopRail';
import { Button } from '@/components/ui/button';

/**
 * Advanced-mode-only wrapper: the actual content lives in `StrategiesPanel`,
 * reused by GrowthPage's "strategies" stage. In simple mode `<ListRoute>`
 * never renders this — it redirects `/app/strategies` to
 * `/app/growth/strategies` instead.
 */
export function StrategiesPage() {
  const { t } = useTranslation();

  return (
    <div>
      <LoopRail />
      <PageHeader
        eyebrow={t('app.nav.strategies')}
        title={t('pages.strategies.title')}
        help={<Help title={t('pages.strategies.helpTitle')}>{t('pages.strategies.help')}</Help>}
        subtitle={t('pages.strategies.subtitle')}
        right={
          <Button asChild>
            <Link to="/app/strategies/new">
              <Plus className="size-4" /> {t('crud.new')}
            </Link>
          </Button>
        }
      />
      <StrategiesPanel />
    </div>
  );
}
