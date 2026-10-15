import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { Help } from '../components/Help';
import { PageHeader } from '../components/PageHeader';
import { LoopRail } from '../components/LoopRail';
import { IcpsPanel } from '@/components/icps/IcpsPanel';
import { Button } from '@/components/ui/button';

export function IcpsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <LoopRail />
      <PageHeader
        eyebrow={t('app.nav.icps')}
        title={t('pages.icps.title')}
        help={<Help title={t('pages.icps.helpTitle')}>{t('pages.icps.help')}</Help>}
        subtitle={t('pages.icps.subtitle')}
        right={
          <Button asChild>
            <Link to="/app/icps/new">
              <Plus className="size-4" /> {t('crud.new')}
            </Link>
          </Button>
        }
      />
      <IcpsPanel />
    </div>
  );
}
