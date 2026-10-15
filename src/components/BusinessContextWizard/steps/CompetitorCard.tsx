import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { TextField } from '@/components/form/TextField';
import { SelectField } from '@/components/form/SelectField';
import { TagsField } from '@/components/form/TagsField';
import { errorMessage } from '@/lib/zod-errors';
import { MARKET_SHARE_OPTIONS } from '@/lib/enums';
import type { Competitor } from '@/types/business-context';

interface CompetitorCardProps {
  competitor: Competitor;
  update: (patch: Partial<Competitor>) => void;
  index: number;
  errors?: FieldErrors<Competitor>;
}

export function CompetitorCard({ competitor, update, index, errors }: CompetitorCardProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <TextField
          htmlFor={`competitor-name-${index}`}
          label={t('wizard.competitive.name')}
          value={competitor.name}
          onChange={(v) => update({ name: v })}
          placeholder={t('wizard.competitive.placeholder.name')}
          error={errorMessage(t, errors?.name)}
        />
        <TextField
          htmlFor={`competitor-website-${index}`}
          label={t('wizard.competitive.website')}
          value={competitor.url}
          onChange={(v) => update({ url: v })}
          placeholder={t('wizard.competitive.placeholder.website')}
          type="url"
          error={errorMessage(t, errors?.url)}
        />
      </div>

      <TagsField
        htmlFor={`competitor-strengths-${index}`}
        label={t('wizard.competitive.strengths')}
        value={competitor.strengths}
        onChange={(v) => update({ strengths: v })}
        placeholder={t('wizard.competitive.placeholder.strengths')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, errors?.strengths)}
      />

      <TagsField
        htmlFor={`competitor-weaknesses-${index}`}
        label={t('wizard.competitive.weaknesses')}
        value={competitor.weaknesses}
        onChange={(v) => update({ weaknesses: v })}
        placeholder={t('wizard.competitive.placeholder.weaknesses')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, errors?.weaknesses)}
      />

      <div className="grid grid-cols-2 gap-4">
        <TextField
          htmlFor={`competitor-pricing-${index}`}
          label={t('wizard.competitive.pricing')}
          value={competitor.pricing}
          onChange={(v) => update({ pricing: v })}
          placeholder={t('wizard.competitive.placeholder.pricing')}
          error={errorMessage(t, errors?.pricing)}
        />
        <TextField
          htmlFor={`competitor-positioning-${index}`}
          label={t('wizard.competitive.positioning')}
          help={t('wizard.competitive.help.positioning')}
          helpTitle={t('wizard.competitive.help.positioningTitle')}
          value={competitor.positioning}
          onChange={(v) => update({ positioning: v })}
          placeholder={t('wizard.competitive.placeholder.positioning')}
          error={errorMessage(t, errors?.positioning)}
        />
      </div>

      <SelectField
        htmlFor={`competitor-market-share-${index}`}
        label={t('wizard.competitive.marketShare')}
        value={competitor.marketShare}
        onChange={(v) => update({ marketShare: v })}
        options={MARKET_SHARE_OPTIONS}
        placeholder={t('wizard.competitive.marketShareUnknown')}
        clearLabel={t('wizard.competitive.marketShareUnknown')}
        translate={t}
        error={errorMessage(t, errors?.marketShare)}
      />
    </div>
  );
}
