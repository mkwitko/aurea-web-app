import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { TextField } from '@/components/form/TextField';
import { NumberField } from '@/components/form/NumberField';
import { Repeater } from '@/components/form/Repeater';
import { errorMessage } from '@/lib/zod-errors';
import { EMPTY_CAMPAIGN_KPI, type Campaign, type CampaignKpi } from '@/types/business-context';

interface KpisRepeaterProps {
  kpis: CampaignKpi[] | undefined;
  onChange: (kpis: CampaignKpi[]) => void;
  /** Typed off `FieldErrors<Campaign>['kpis']`, same reasoning as `ChannelsRepeater`/`ObjectivesRepeater`. */
  errors?: FieldErrors<Campaign>['kpis'];
  /**
   * The parent campaign's stable id. `CampaignsStep` renders every campaign
   * card at once (no accordion), so a local `index` alone collides across
   * siblings — two campaigns each with a first KPI would both emit
   * `id="kpi-name-0"`. Prefixing every id with the owning campaign's id keeps
   * every KPI's ids unique across the whole page.
   */
  campaignId: string;
}

/** `CampaignKpi` has no `id` (types/business-context.ts) — `newItem` does not generate one. */
export function KpisRepeater({ kpis, onChange, errors, campaignId }: KpisRepeaterProps) {
  const { t } = useTranslation();

  return (
    <Repeater<CampaignKpi>
      items={kpis}
      onChange={onChange}
      newItem={() => ({ ...EMPTY_CAMPAIGN_KPI })}
      itemLabel={(index) => t('wizard.campaigns.kpiN', { n: index + 1 })}
      addLabel={t('wizard.campaigns.addKpi')}
      removeLabel={t('wizard.campaigns.remove')}
      renderItem={(kpi, update, index) => {
        const itemErrors = errors?.[index];
        return (
          <div className="grid grid-cols-2 gap-4">
            <TextField
              htmlFor={`campaign-${campaignId}-kpi-name-${index}`}
              label={t('wizard.campaigns.kpiName')}
              value={kpi.name}
              onChange={(v) => update({ name: v })}
              placeholder={t('wizard.campaigns.placeholder.kpiName')}
              error={errorMessage(t, itemErrors?.name)}
            />
            <NumberField
              htmlFor={`campaign-${campaignId}-kpi-target-${index}`}
              label={t('wizard.campaigns.kpiTarget')}
              help={t('wizard.campaigns.help.kpiTarget')}
              helpTitle={t('wizard.campaigns.help.kpiTargetTitle')}
              value={kpi.target}
              onChange={(v) => update({ target: v })}
              error={errorMessage(t, itemErrors?.target)}
            />
            <NumberField
              htmlFor={`campaign-${campaignId}-kpi-current-${index}`}
              label={t('wizard.campaigns.kpiCurrent')}
              help={t('wizard.campaigns.help.kpiCurrent')}
              helpTitle={t('wizard.campaigns.help.kpiCurrentTitle')}
              value={kpi.current}
              onChange={(v) => update({ current: v })}
              error={errorMessage(t, itemErrors?.current)}
            />
            <TextField
              htmlFor={`campaign-${campaignId}-kpi-unit-${index}`}
              label={t('wizard.campaigns.kpiUnit')}
              value={kpi.unit}
              onChange={(v) => update({ unit: v })}
              placeholder={t('wizard.campaigns.placeholder.kpiUnit')}
              error={errorMessage(t, itemErrors?.unit)}
            />
          </div>
        );
      }}
    />
  );
}
