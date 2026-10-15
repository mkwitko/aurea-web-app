import { Trans, useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { NumberField } from '@/components/form/NumberField';
import { SelectField } from '@/components/form/SelectField';
import { TagsField } from '@/components/form/TagsField';
import { errorMessage } from '@/lib/zod-errors';
import { URGENCY_OPTIONS } from '@/lib/enums';
import type { BusinessConstraints, BusinessContextData } from '@/types/business-context';

interface ConstraintsStepProps {
  data: BusinessContextData;
  onChange: (data: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export function ConstraintsStep({ data, onChange, errors }: ConstraintsStepProps) {
  const { t } = useTranslation();
  const constraints = data.constraints;
  const fieldErrors = errors?.constraints;

  const update = (patch: Partial<BusinessConstraints>) =>
    onChange({
      constraints: {
        monthlyGrowthBudget: constraints?.monthlyGrowthBudget,
        teamSize: constraints?.teamSize,
        growthTeamSize: constraints?.growthTeamSize,
        technicalCapabilities: constraints?.technicalCapabilities ?? [],
        limitations: constraints?.limitations ?? [],
        regulatoryConstraints: constraints?.regulatoryConstraints,
        urgency: constraints?.urgency,
        ...patch,
      },
    });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('wizard.constraints.intro')}</p>

      <div className="grid grid-cols-3 gap-4">
        <NumberField
          htmlFor="budget"
          label={t('wizard.constraints.monthlyGrowthBudget')}
          help={t('wizard.constraints.help.budget')}
          helpTitle={t('wizard.constraints.help.budgetTitle')}
          value={constraints?.monthlyGrowthBudget}
          onChange={(v) => update({ monthlyGrowthBudget: v })}
          placeholder={t('wizard.constraints.placeholder.budget')}
          error={errorMessage(t, fieldErrors?.monthlyGrowthBudget)}
        />
        <NumberField
          htmlFor="team-size"
          label={t('wizard.constraints.teamSize')}
          help={t('wizard.constraints.help.teamSize')}
          helpTitle={t('wizard.constraints.help.teamSizeTitle')}
          value={constraints?.teamSize}
          onChange={(v) => update({ teamSize: v })}
          placeholder={t('wizard.constraints.placeholder.teamSize')}
          error={errorMessage(t, fieldErrors?.teamSize)}
        />
        <NumberField
          htmlFor="growth-team"
          label={t('wizard.constraints.growthTeam')}
          help={t('wizard.constraints.help.growthTeam')}
          helpTitle={t('wizard.constraints.help.growthTeamTitle')}
          value={constraints?.growthTeamSize}
          onChange={(v) => update({ growthTeamSize: v })}
          placeholder={t('wizard.constraints.placeholder.growthTeam')}
          error={errorMessage(t, fieldErrors?.growthTeamSize)}
        />
      </div>

      <SelectField
        htmlFor="urgency"
        label={t('wizard.constraints.urgency')}
        help={t('wizard.constraints.help.urgency')}
        helpTitle={t('wizard.constraints.help.urgencyTitle')}
        value={constraints?.urgency}
        onChange={(v) => update({ urgency: v })}
        options={URGENCY_OPTIONS}
        placeholder={t('wizard.constraints.urgencySelect')}
        clearLabel={t('wizard.constraints.urgencySelect')}
        translate={t}
        error={errorMessage(t, fieldErrors?.urgency)}
      />

      <TagsField
        htmlFor="technical-capabilities"
        label={t('wizard.constraints.technicalCapabilities')}
        help={t('wizard.constraints.help.capabilities')}
        helpTitle={t('wizard.constraints.help.capabilitiesTitle')}
        value={constraints?.technicalCapabilities}
        onChange={(v) => update({ technicalCapabilities: v })}
        placeholder={t('wizard.constraints.placeholder.addCapability')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.technicalCapabilities)}
      />
      <TagsField
        htmlFor="limitations"
        label={t('wizard.constraints.limitations')}
        help={t('wizard.constraints.help.limitations')}
        helpTitle={t('wizard.constraints.help.limitationsTitle')}
        value={constraints?.limitations}
        onChange={(v) => update({ limitations: v })}
        placeholder={t('wizard.constraints.placeholder.addLimitation')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.limitations)}
      />
      <TagsField
        htmlFor="regulatory"
        label={t('wizard.constraints.regulatory')}
        help={t('wizard.constraints.help.regulatory')}
        helpTitle={t('wizard.constraints.help.regulatoryTitle')}
        value={constraints?.regulatoryConstraints}
        onChange={(v) => update({ regulatoryConstraints: v })}
        placeholder={t('wizard.constraints.placeholder.addRegulatory')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.regulatoryConstraints)}
      />

      <div className="text-sm text-muted-foreground mt-4">
        <Trans i18nKey="wizard.constraints.tip" components={{ strong: <strong /> }} />
      </div>
    </div>
  );
}
