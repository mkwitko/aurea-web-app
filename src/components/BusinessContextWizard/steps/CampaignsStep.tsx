import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { Repeater } from '@/components/form/Repeater';
import { CampaignCard } from './CampaignCard';
import { EMPTY_CAMPAIGN, type BusinessContextData, type Campaign } from '@/types/business-context';

interface CampaignsStepProps {
  data: BusinessContextData;
  onChange: (data: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export function CampaignsStep({ data, onChange, errors }: CampaignsStepProps) {
  const { t } = useTranslation();
  const projects = data.projects ?? [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('wizard.campaigns.intro')}</p>

      <Repeater<Campaign>
        items={data.campaigns}
        onChange={(campaigns) => onChange({ campaigns })}
        newItem={() => ({ id: nanoid(), ...EMPTY_CAMPAIGN })}
        itemLabel={(index) => t('wizard.campaigns.campaignN', { n: index + 1 })}
        addLabel={t('wizard.campaigns.addCampaign')}
        removeLabel={t('wizard.campaigns.remove')}
        emptyLabel={t('wizard.campaigns.empty')}
        renderItem={(campaign, update, index) => (
          <CampaignCard
            campaign={campaign}
            projects={projects}
            update={update}
            index={index}
            errors={errors?.campaigns?.[index]}
          />
        )}
      />
    </div>
  );
}
