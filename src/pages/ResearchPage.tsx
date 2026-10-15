import { useTranslation } from 'react-i18next';
import { ResearchPanel } from '@/components/research/ResearchPanel';
import { Help } from '../components/Help';
import { PageHeader } from '../components/PageHeader';
import { LoopRail } from '../components/LoopRail';

export function ResearchPage() {
  const { t } = useTranslation();

  return (
    <div>
      <LoopRail />
      <PageHeader
        eyebrow={t('app.nav.research')}
        title={t('pages.research.title')}
        help={<Help title={t('pages.research.helpTitle')}>{t('pages.research.help')}</Help>}
        subtitle={t('pages.research.subtitle')}
      />
      <ResearchPanel />
    </div>
  );
}
