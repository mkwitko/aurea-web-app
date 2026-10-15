import { Trans, useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { TextField } from '@/components/form/TextField';
import { errorMessage } from '@/lib/zod-errors';
import { Label } from '@/components/ui/label';
import { Help } from '@/components/Help';
import type { BusinessContextData, CurrentPerformance } from '@/types/business-context';
import { PerformanceMetricsGrid } from './PerformanceMetricsGrid';
import { ChannelsRepeater } from './ChannelsRepeater';

interface PerformanceStepProps {
  data: BusinessContextData;
  onChange: (data: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export function PerformanceStep({ data, onChange, errors }: PerformanceStepProps) {
  const { t } = useTranslation();
  const performance = data.currentPerformance;
  const fieldErrors = errors?.currentPerformance;

  const update = (patch: Partial<CurrentPerformance>) =>
    onChange({
      currentPerformance: {
        mrr: performance?.mrr,
        arr: performance?.arr,
        totalCustomers: performance?.totalCustomers,
        activeCustomers: performance?.activeCustomers,
        churnRate: performance?.churnRate,
        monthlySignups: performance?.monthlySignups,
        cac: performance?.cac,
        ltv: performance?.ltv,
        ltvCacRatio: performance?.ltvCacRatio,
        conversionRate: performance?.conversionRate,
        timeToConvert: performance?.timeToConvert,
        channels: performance?.channels ?? [],
        baselineDate: performance?.baselineDate,
        ...patch,
      },
    });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('wizard.performance.intro')}</p>

      <PerformanceMetricsGrid data={data} update={update} errors={fieldErrors} />

      <TextField
        htmlFor="baseline-date"
        label={t('wizard.performance.baselineDate')}
        type="date"
        help={t('wizard.performance.help.baselineDate')}
        helpTitle={t('wizard.performance.help.baselineDateTitle')}
        value={performance?.baselineDate?.slice(0, 10)}
        onChange={(v) => update({ baselineDate: v ? new Date(v).toISOString() : undefined })}
        error={errorMessage(t, fieldErrors?.baselineDate)}
      />

      <div className="space-y-4">
        <Label>
          {t('wizard.performance.channels')}
          <Help title={t('wizard.performance.help.channelsTitle')}>{t('wizard.performance.help.channels')}</Help>
        </Label>
        <ChannelsRepeater
          channels={performance?.channels}
          onChange={(channels) => update({ channels })}
          errors={fieldErrors?.channels}
        />
      </div>

      <div className="text-sm text-muted-foreground mt-4">
        <Trans i18nKey="wizard.performance.tip" components={{ strong: <strong /> }} />
      </div>
    </div>
  );
}
