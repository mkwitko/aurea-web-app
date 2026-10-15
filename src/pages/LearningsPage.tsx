import { useTranslation } from 'react-i18next';
import { LearningsPanel } from '@/components/growth/LearningsPanel';
import { Help } from '../components/Help';
import { PageHeader } from '../components/PageHeader';

/**
 * Advanced-mode-only wrapper: the actual content lives in `LearningsPanel`,
 * reused by GrowthPage's "learnings" stage. In simple mode `<ListRoute>` never
 * renders this — it redirects `/app/learnings` to `/app/growth/learnings`
 * instead.
 */
export function LearningsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        eyebrow={t('app.nav.learnings')}
        title={t('pages.learnings.title')}
        help={<Help title={t('pages.learnings.helpTitle')}>{t('pages.learnings.help')}</Help>}
        subtitle={t('pages.learnings.subtitle')}
      />
      <LearningsPanel />
    </div>
  );
}
