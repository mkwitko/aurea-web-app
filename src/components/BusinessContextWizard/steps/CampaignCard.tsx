import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { TextField } from '@/components/form/TextField';
import { TextAreaField } from '@/components/form/TextAreaField';
import { NumberField } from '@/components/form/NumberField';
import { SelectField } from '@/components/form/SelectField';
import { errorMessage } from '@/lib/zod-errors';
import { Label } from '@/components/ui/label';
import { Help } from '@/components/Help';
import { CAMPAIGN_STATUS_OPTIONS } from '@/lib/enums';
import type { Campaign, Project } from '@/types/business-context';
import { KpisRepeater } from './KpisRepeater';

interface CampaignCardProps {
  campaign: Campaign;
  projects: Project[];
  update: (patch: Partial<Campaign>) => void;
  index: number;
  errors?: FieldErrors<Campaign>;
}

export function CampaignCard({ campaign, projects, update, index, errors }: CampaignCardProps) {
  const { t } = useTranslation();

  // Dynamic select, options built from live sibling data — same pattern as
  // the goal select in StrategyNewPage: `translate` is the identity function
  // because the label is already the project's own name, not an i18n key.
  const projectOptions = projects.map((p, i) => ({
    value: p.id,
    labelKey: p.name || t('wizard.campaigns.linkedProjectProjectN', { n: i + 1 }),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <TextField
          htmlFor={`campaign-name-${index}`}
          label={t('wizard.campaigns.campaignName')}
          value={campaign.name}
          onChange={(v) => update({ name: v })}
          placeholder={t('wizard.campaigns.placeholder.campaignName')}
          error={errorMessage(t, errors?.name)}
        />
        <TextField
          htmlFor={`campaign-channel-${index}`}
          label={t('wizard.campaigns.channel')}
          value={campaign.channel}
          onChange={(v) => update({ channel: v })}
          placeholder={t('wizard.campaigns.placeholder.channel')}
          error={errorMessage(t, errors?.channel)}
        />
      </div>

      <TextAreaField
        htmlFor={`campaign-desc-${index}`}
        label={t('wizard.campaigns.description')}
        value={campaign.description}
        onChange={(v) => update({ description: v })}
        placeholder={t('wizard.campaigns.placeholder.description')}
        rows={2}
        error={errorMessage(t, errors?.description)}
      />

      <div className="grid grid-cols-3 gap-4">
        <SelectField
          htmlFor={`campaign-status-${index}`}
          label={t('wizard.campaigns.status')}
          value={campaign.status}
          onChange={(v) => update({ status: v })}
          options={CAMPAIGN_STATUS_OPTIONS}
          translate={t}
          error={errorMessage(t, errors?.status)}
        />
        <NumberField
          htmlFor={`campaign-budget-${index}`}
          label={t('wizard.campaigns.budget')}
          value={campaign.budget}
          onChange={(v) => update({ budget: v })}
          placeholder={t('wizard.campaigns.placeholder.budget')}
          error={errorMessage(t, errors?.budget)}
        />
        <SelectField
          htmlFor={`campaign-project-${index}`}
          label={t('wizard.campaigns.linkedProject')}
          help={t('wizard.campaigns.help.linkedProject')}
          helpTitle={t('wizard.campaigns.help.linkedProjectTitle')}
          value={campaign.projectId}
          onChange={(v) => update({ projectId: v })}
          options={projectOptions}
          placeholder={t('wizard.campaigns.linkedProjectNone')}
          clearLabel={t('wizard.campaigns.linkedProjectNone')}
          translate={(label) => label}
          error={errorMessage(t, errors?.projectId)}
        />
      </div>

      <TextField
        htmlFor={`campaign-audience-${index}`}
        label={t('wizard.campaigns.targetAudience')}
        help={t('wizard.campaigns.help.targetAudience')}
        helpTitle={t('wizard.campaigns.help.targetAudienceTitle')}
        value={campaign.targetAudience}
        onChange={(v) => update({ targetAudience: v })}
        placeholder={t('wizard.campaigns.placeholder.targetAudience')}
        error={errorMessage(t, errors?.targetAudience)}
      />

      <div className="grid grid-cols-2 gap-4">
        <TextField
          htmlFor={`campaign-start-${index}`}
          label={t('wizard.campaigns.startDate')}
          type="date"
          value={campaign.startDate}
          onChange={(v) => update({ startDate: v })}
          error={errorMessage(t, errors?.startDate)}
        />
        <TextField
          htmlFor={`campaign-end-${index}`}
          label={t('wizard.campaigns.endDate')}
          type="date"
          value={campaign.endDate}
          onChange={(v) => update({ endDate: v })}
          error={errorMessage(t, errors?.endDate)}
        />
      </div>

      <div className="space-y-4 border-t pt-4">
        <Label>
          {t('wizard.campaigns.kpis')}
          <Help title={t('wizard.campaigns.help.kpisTitle')}>{t('wizard.campaigns.help.kpis')}</Help>
        </Label>
        <KpisRepeater
          kpis={campaign.kpis}
          onChange={(kpis) => update({ kpis })}
          errors={errors?.kpis}
          campaignId={campaign.id}
        />
      </div>
    </div>
  );
}
