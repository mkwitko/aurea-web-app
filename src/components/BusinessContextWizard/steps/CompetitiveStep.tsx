import { Trans, useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { TextAreaField } from '@/components/form/TextAreaField';
import { SelectField } from '@/components/form/SelectField';
import { TagsField } from '@/components/form/TagsField';
import { Repeater } from '@/components/form/Repeater';
import { errorMessage } from '@/lib/zod-errors';
import { Label } from '@/components/ui/label';
import { Help } from '@/components/Help';
import { MARKET_POSITION_OPTIONS } from '@/lib/enums';
import { EMPTY_COMPETITOR, type BusinessContextData, type Competitor, type CompetitiveLandscape } from '@/types/business-context';
import { CompetitorCard } from './CompetitorCard';

interface CompetitiveStepProps {
  data: BusinessContextData;
  onChange: (data: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export function CompetitiveStep({ data, onChange, errors }: CompetitiveStepProps) {
  const { t } = useTranslation();
  const landscape = data.competitiveLandscape;
  const fieldErrors = errors?.competitiveLandscape;

  const update = (patch: Partial<CompetitiveLandscape>) =>
    onChange({
      competitiveLandscape: {
        competitors: landscape?.competitors ?? [],
        competitiveAdvantages: landscape?.competitiveAdvantages ?? [],
        threatsFromCompetitors: landscape?.threatsFromCompetitors ?? [],
        ourDifferentiator: landscape?.ourDifferentiator,
        marketPosition: landscape?.marketPosition,
        ...patch,
      },
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('wizard.competitive.intro')}</p>
      <TextAreaField
        htmlFor="differentiator"
        label={t('wizard.competitive.mainDifferentiator')}
        help={t('wizard.competitive.help.differentiator')}
        helpTitle={t('wizard.competitive.help.differentiatorTitle')}
        value={landscape?.ourDifferentiator}
        onChange={(v) => update({ ourDifferentiator: v })}
        placeholder={t('wizard.competitive.placeholder.differentiator')}
        rows={2}
        error={errorMessage(t, fieldErrors?.ourDifferentiator)}
      />
      <SelectField
        htmlFor="market-position"
        label={t('wizard.competitive.marketPosition')}
        help={t('wizard.competitive.help.marketPosition')}
        helpTitle={t('wizard.competitive.help.marketPositionTitle')}
        value={landscape?.marketPosition}
        onChange={(v) => update({ marketPosition: v })}
        options={MARKET_POSITION_OPTIONS}
        placeholder={t('wizard.competitive.marketPositionSelect')}
        clearLabel={t('wizard.competitive.marketPositionSelect')}
        translate={t}
        error={errorMessage(t, fieldErrors?.marketPosition)}
      />
      <div className="space-y-4">
        <Label>
          {t('wizard.competitive.mainCompetitors')}
          <Help title={t('wizard.competitive.help.competitorsTitle')}>{t('wizard.competitive.help.competitors')}</Help>
        </Label>
        <Repeater<Competitor>
          items={landscape?.competitors}
          onChange={(competitors) => update({ competitors })}
          newItem={() => ({ ...EMPTY_COMPETITOR })}
          itemLabel={(index) => t('wizard.competitive.competitorN', { n: index + 1 })}
          addLabel={t('wizard.competitive.addCompetitor')}
          removeLabel={t('wizard.competitive.remove')}
          renderItem={(competitor, itemUpdate, index) => (
            <CompetitorCard
              competitor={competitor}
              update={itemUpdate}
              index={index}
              errors={fieldErrors?.competitors?.[index]}
            />
          )}
        />
      </div>
      <TagsField
        htmlFor="competitive-advantages"
        label={t('wizard.competitive.competitiveAdvantages')}
        help={t('wizard.competitive.help.advantages')}
        helpTitle={t('wizard.competitive.help.advantagesTitle')}
        value={landscape?.competitiveAdvantages}
        onChange={(v) => update({ competitiveAdvantages: v })}
        placeholder={t('wizard.competitive.placeholder.addAdvantage')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.competitiveAdvantages)}
      />
      <TagsField
        htmlFor="threats-from-competitors"
        label={t('wizard.competitive.threatsFromCompetitors')}
        help={t('wizard.competitive.help.threatsFromCompetitors')}
        helpTitle={t('wizard.competitive.help.threatsFromCompetitorsTitle')}
        value={landscape?.threatsFromCompetitors}
        onChange={(v) => update({ threatsFromCompetitors: v })}
        placeholder={t('wizard.competitive.placeholder.threatsFromCompetitors')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.threatsFromCompetitors)}
      />
      {(landscape?.competitors?.length ?? 0) > 0 && (
        <div className="text-sm text-muted-foreground mt-4">
          <Trans i18nKey="wizard.competitive.tip" components={{ strong: <strong /> }} />
        </div>
      )}
    </div>
  );
}
