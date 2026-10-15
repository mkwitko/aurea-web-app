import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { Help } from '@/components/Help';
import { Ga4SourceCard } from '@/components/integrations/Ga4SourceCard';
import { SocialSourceCard } from '@/components/integrations/SocialSourceCard';

// Sem `LoopRail`: conectar uma fonte é configuração, não uma etapa do loop.
export function IntegrationsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        eyebrow={t('app.nav.integrations')}
        title={t('pages.integrations.title')}
        help={<Help title={t('pages.integrations.helpTitle')}>{t('pages.integrations.help')}</Help>}
        subtitle={t('pages.integrations.subtitle')}
      />
      <div className="space-y-4">
        <Ga4SourceCard />
        <SocialSourceCard />
      </div>
    </div>
  );
}
