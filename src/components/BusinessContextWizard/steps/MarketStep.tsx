import { Trans, useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { CurrencyField } from '@/components/form/CurrencyField';
import { NumberField } from '@/components/form/NumberField';
import { SelectField } from '@/components/form/SelectField';
import { TagsField } from '@/components/form/TagsField';
import { errorMessage } from '@/lib/zod-errors';
import { MATURITY_OPTIONS } from '@/lib/enums';
import type { BusinessContextData, MarketContext } from '@/types/business-context';

interface MarketStepProps {
  data: BusinessContextData;
  onChange: (data: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export function MarketStep({ data, onChange, errors }: MarketStepProps) {
  const { t } = useTranslation();
  const market = data.marketContext;
  const fieldErrors = errors?.marketContext;

  const update = (patch: Partial<MarketContext>) =>
    onChange({
      marketContext: {
        tam: market?.tam,
        sam: market?.sam,
        som: market?.som,
        marketGrowthRate: market?.marketGrowthRate,
        trends: market?.trends ?? [],
        opportunities: market?.opportunities ?? [],
        threats: market?.threats ?? [],
        maturity: market?.maturity,
        ...patch,
      },
    });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('wizard.market.intro')}</p>

      <div className="space-y-4">
        <h3 className="font-semibold">{t('wizard.market.marketSize')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <CurrencyField
            htmlFor="tam"
            label={t('wizard.market.tam')}
            help={t('wizard.market.help.tam')}
            helpTitle={t('wizard.market.help.tamTitle')}
            value={market?.tam}
            onChange={(v) => update({ tam: v })}
            placeholder={t('wizard.market.placeholder.tam')}
            error={errorMessage(t, fieldErrors?.tam)}
          />
          <CurrencyField
            htmlFor="sam"
            label={t('wizard.market.sam')}
            help={t('wizard.market.help.sam')}
            helpTitle={t('wizard.market.help.samTitle')}
            value={market?.sam}
            onChange={(v) => update({ sam: v })}
            placeholder={t('wizard.market.placeholder.sam')}
            error={errorMessage(t, fieldErrors?.sam)}
          />
          <CurrencyField
            htmlFor="som"
            label={t('wizard.market.som')}
            help={t('wizard.market.help.som')}
            helpTitle={t('wizard.market.help.somTitle')}
            value={market?.som}
            onChange={(v) => update({ som: v })}
            placeholder={t('wizard.market.placeholder.som')}
            error={errorMessage(t, fieldErrors?.som)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <NumberField
          htmlFor="growth-rate"
          label={t('wizard.market.growthRate')}
          help={t('wizard.market.help.growthRate')}
          helpTitle={t('wizard.market.help.growthRateTitle')}
          value={market?.marketGrowthRate}
          onChange={(v) => update({ marketGrowthRate: v })}
          placeholder={t('wizard.market.placeholder.growthRate')}
          error={errorMessage(t, fieldErrors?.marketGrowthRate)}
        />
        <SelectField
          htmlFor="maturity"
          label={t('wizard.market.maturity')}
          help={t('wizard.market.help.maturity')}
          helpTitle={t('wizard.market.help.maturityTitle')}
          value={market?.maturity}
          onChange={(v) => update({ maturity: v })}
          options={MATURITY_OPTIONS}
          placeholder={t('wizard.market.maturitySelect')}
          clearLabel={t('wizard.market.maturitySelect')}
          translate={t}
          error={errorMessage(t, fieldErrors?.maturity)}
        />
      </div>

      <TagsField
        htmlFor="trends"
        label={t('wizard.market.trends')}
        help={t('wizard.market.help.trends')}
        helpTitle={t('wizard.market.help.trendsTitle')}
        value={market?.trends}
        onChange={(v) => update({ trends: v })}
        placeholder={t('wizard.market.placeholder.addTrend')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.trends)}
      />
      <TagsField
        htmlFor="opportunities"
        label={t('wizard.market.opportunities')}
        help={t('wizard.market.help.opportunities')}
        helpTitle={t('wizard.market.help.opportunitiesTitle')}
        value={market?.opportunities}
        onChange={(v) => update({ opportunities: v })}
        placeholder={t('wizard.market.placeholder.addOpportunity')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.opportunities)}
      />
      <TagsField
        htmlFor="threats"
        label={t('wizard.market.threats')}
        help={t('wizard.market.help.threats')}
        helpTitle={t('wizard.market.help.threatsTitle')}
        value={market?.threats}
        onChange={(v) => update({ threats: v })}
        placeholder={t('wizard.market.placeholder.addThreat')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.threats)}
      />

      <div className="text-sm text-muted-foreground mt-4">
        <Trans i18nKey="wizard.market.tip" components={{ strong: <strong /> }} />
      </div>
    </div>
  );
}
