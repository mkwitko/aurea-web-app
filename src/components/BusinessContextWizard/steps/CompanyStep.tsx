import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { TextField } from '@/components/form/TextField';
import { TextAreaField } from '@/components/form/TextAreaField';
import { NumberField } from '@/components/form/NumberField';
import { SelectField } from '@/components/form/SelectField';
import { TagsField } from '@/components/form/TagsField';
import { errorMessage } from '@/lib/zod-errors';
import { FUNDING_STAGE_OPTIONS } from '@/lib/enums';
import { LogoUpload } from '../LogoUpload';
import { FileUpload } from '../FileUpload';
import type { BusinessContextData, CompanyProfile } from '@/types/business-context';

interface CompanyStepProps {
  data: BusinessContextData;
  onChange: (data: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export function CompanyStep({ data, onChange, errors }: CompanyStepProps) {
  const { t } = useTranslation();
  const profile = data.companyProfile;
  const fieldErrors = errors?.companyProfile;

  const update = (patch: Partial<CompanyProfile>) =>
    onChange({ companyProfile: { ...data.companyProfile, ...patch } });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('wizard.company.intro')}</p>
      <LogoUpload currentUrl={profile?.logoUrl} onUpload={(url) => update({ logoUrl: url })} />
      <div className="grid grid-cols-2 gap-4">
        <NumberField
          htmlFor="foundedYear"
          label={t('wizard.company.foundedYear')}
          help={t('wizard.company.help.foundedYear')}
          helpTitle={t('wizard.company.help.foundedYearTitle')}
          value={profile?.foundedYear}
          onChange={(v) => update({ foundedYear: v })}
          placeholder={t('wizard.company.placeholder.foundedYear')}
          error={errorMessage(t, fieldErrors?.foundedYear)}
        />
        <TextField
          htmlFor="headquarters"
          label={t('wizard.company.headquarters')}
          help={t('wizard.company.help.headquarters')}
          helpTitle={t('wizard.company.help.headquartersTitle')}
          value={profile?.headquarters}
          onChange={(v) => update({ headquarters: v })}
          placeholder={t('wizard.company.placeholder.headquarters')}
          error={errorMessage(t, fieldErrors?.headquarters)}
        />
        <NumberField
          htmlFor="employeeCount"
          label={t('wizard.company.employees')}
          help={t('wizard.company.help.employees')}
          helpTitle={t('wizard.company.help.employeesTitle')}
          value={profile?.employeeCount}
          onChange={(v) => update({ employeeCount: v })}
          placeholder={t('wizard.company.placeholder.employees')}
          error={errorMessage(t, fieldErrors?.employeeCount)}
        />
        <SelectField
          htmlFor="fundingStage"
          label={t('wizard.company.fundingStage')}
          help={t('wizard.company.help.fundingStage')}
          helpTitle={t('wizard.company.help.fundingStageTitle')}
          value={profile?.fundingStage}
          onChange={(v) => update({ fundingStage: v })}
          options={FUNDING_STAGE_OPTIONS}
          placeholder={t('wizard.company.fundingStageSelect')}
          clearLabel={t('wizard.company.fundingStageSelect')}
          translate={t}
          error={errorMessage(t, fieldErrors?.fundingStage)}
        />
      </div>
      <TextAreaField
        htmlFor="mission"
        label={t('wizard.company.mission')}
        help={t('wizard.company.help.mission')}
        helpTitle={t('wizard.company.help.missionTitle')}
        value={profile?.mission}
        onChange={(v) => update({ mission: v })}
        placeholder={t('wizard.company.placeholder.mission')}
        error={errorMessage(t, fieldErrors?.mission)}
      />
      <TextAreaField
        htmlFor="vision"
        label={t('wizard.company.vision')}
        help={t('wizard.company.help.vision')}
        helpTitle={t('wizard.company.help.visionTitle')}
        value={profile?.vision}
        onChange={(v) => update({ vision: v })}
        placeholder={t('wizard.company.placeholder.vision')}
        error={errorMessage(t, fieldErrors?.vision)}
      />
      <TextAreaField
        htmlFor="brandVoice"
        label={t('wizard.company.brandVoice')}
        help={t('wizard.company.help.brandVoice')}
        helpTitle={t('wizard.company.help.brandVoiceTitle')}
        value={profile?.brandVoice}
        onChange={(v) => update({ brandVoice: v })}
        placeholder={t('wizard.company.placeholder.brandVoice')}
        error={errorMessage(t, fieldErrors?.brandVoice)}
      />
      <TagsField
        htmlFor="values"
        label={t('wizard.company.values')}
        help={t('wizard.company.help.values')}
        helpTitle={t('wizard.company.help.valuesTitle')}
        value={profile?.values}
        onChange={(v) => update({ values: v })}
        placeholder={t('wizard.company.placeholder.values')}
        addLabel={t('wizard.company.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.values)}
      />
      <FileUpload files={profile?.documentUrls ?? []} onChange={(urls) => update({ documentUrls: urls })} />
    </div>
  );
}
