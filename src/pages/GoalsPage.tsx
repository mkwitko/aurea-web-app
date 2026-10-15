import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { GoalsPanel } from '@/components/growth/GoalsPanel';
import { Help } from '../components/Help';
import { PageHeader } from '../components/PageHeader';
import { LoopRail } from '../components/LoopRail';
import { Button } from '@/components/ui/button';

/**
 * Advanced-mode-only wrapper: the actual list lives in `GoalsPanel`, reused by
 * GrowthPage's "goals" stage. In simple mode `<ListRoute>` never renders this
 * — it redirects `/app/goals` to `/app/growth/goals` instead.
 */
export function GoalsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <LoopRail />
      <PageHeader
        eyebrow={t('app.nav.goals')}
        title={t('pages.goals.title')}
        help={<Help title={t('pages.goals.helpTitle')}>{t('pages.goals.help')}</Help>}
        subtitle={t('pages.goals.subtitle')}
        right={
          <Button asChild>
            <Link to="/app/goals/new">
              <Plus className="size-4" /> {t('crud.new')}
            </Link>
          </Button>
        }
      />
      <GoalsPanel />
    </div>
  );
}
