import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { NumberField } from '@/components/form/NumberField';
import { errorMessage } from '@/lib/zod-errors';
import { derivePerformance } from '@/lib/derive-performance';
import type { BusinessContextData, CurrentPerformance } from '@/types/business-context';

interface PerformanceMetricsGridProps {
  data: BusinessContextData;
  update: (patch: Partial<CurrentPerformance>) => void;
  errors?: FieldErrors<CurrentPerformance>;
}

/**
 * The eleven scalar metrics, grouped under the same four headers the
 * original hand-rolled markup used (Revenue / Customers / Acquisition /
 * Conversion) — a non-technical founder scanning eleven financial metrics
 * needs that grouping more than `PerformanceStep.tsx` needs to stay under
 * the line-count gate by flattening it away.
 *
 * Takes the whole `BusinessContextData`, not just `currentPerformance`:
 * `cac` is derived from `currentActivities.paidAdvertising.monthlySpend`,
 * which lives outside this section's own slice.
 */
export function PerformanceMetricsGrid({ data, update, errors }: PerformanceMetricsGridProps) {
  const { t } = useTranslation();
  const performance = data.currentPerformance;
  const derived = derivePerformance(data);

  return (
    <>
      <div className="space-y-4">
        <h3 className="font-semibold">{t('wizard.performance.revenue')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            htmlFor="mrr"
            label={t('wizard.performance.mrr')}
            help={t('wizard.performance.help.mrr')}
            helpTitle={t('wizard.performance.help.mrrTitle')}
            value={performance?.mrr}
            onChange={(v) => update({ mrr: v })}
            placeholder={t('wizard.performance.placeholder.mrr')}
            error={errorMessage(t, errors?.mrr)}
          />
          <div className="space-y-1">
            <NumberField
              htmlFor="arr"
              label={t('wizard.performance.arr')}
              help={t('wizard.performance.help.arr')}
              helpTitle={t('wizard.performance.help.arrTitle')}
              value={performance?.arr ?? derived.arr?.value}
              onChange={(v) => update({ arr: v })}
              placeholder={t('wizard.performance.placeholder.arr')}
              error={errorMessage(t, errors?.arr)}
            />
            {derived.arr && performance?.arr === undefined && (
              <p className="text-xs text-muted-foreground">
                {t('wizard.performance.derived.arr', derived.arr.params)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">{t('wizard.performance.customers')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <NumberField
            htmlFor="total-customers"
            label={t('wizard.performance.totalCustomers')}
            help={t('wizard.performance.help.totalCustomers')}
            helpTitle={t('wizard.performance.help.totalCustomersTitle')}
            value={performance?.totalCustomers}
            onChange={(v) => update({ totalCustomers: v })}
            placeholder={t('wizard.performance.placeholder.totalCustomers')}
            error={errorMessage(t, errors?.totalCustomers)}
          />
          <NumberField
            htmlFor="active-customers"
            label={t('wizard.performance.activeCustomers')}
            help={t('wizard.performance.help.activeCustomers')}
            helpTitle={t('wizard.performance.help.activeCustomersTitle')}
            value={performance?.activeCustomers}
            onChange={(v) => update({ activeCustomers: v })}
            placeholder={t('wizard.performance.placeholder.activeCustomers')}
            error={errorMessage(t, errors?.activeCustomers)}
          />
          <NumberField
            htmlFor="churn"
            label={t('wizard.performance.churn')}
            help={t('wizard.performance.help.churn')}
            helpTitle={t('wizard.performance.help.churnTitle')}
            value={performance?.churnRate}
            onChange={(v) => update({ churnRate: v })}
            placeholder={t('wizard.performance.placeholder.churn')}
            error={errorMessage(t, errors?.churnRate)}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">{t('wizard.performance.acquisition')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            htmlFor="signups"
            label={t('wizard.performance.monthlySignups')}
            help={t('wizard.performance.help.signups')}
            helpTitle={t('wizard.performance.help.signupsTitle')}
            value={performance?.monthlySignups}
            onChange={(v) => update({ monthlySignups: v })}
            placeholder={t('wizard.performance.placeholder.signups')}
            error={errorMessage(t, errors?.monthlySignups)}
          />
          <div className="space-y-1">
            <NumberField
              htmlFor="cac"
              label={t('wizard.performance.cac')}
              help={t('wizard.performance.help.cac')}
              helpTitle={t('wizard.performance.help.cacTitle')}
              value={performance?.cac ?? derived.cac?.value}
              onChange={(v) => update({ cac: v })}
              placeholder={t('wizard.performance.placeholder.cac')}
              error={errorMessage(t, errors?.cac)}
            />
            {derived.cac && performance?.cac === undefined && (
              <p className="text-xs text-muted-foreground">
                {t('wizard.performance.derived.cac', derived.cac.params)}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <NumberField
              htmlFor="ltv"
              label={t('wizard.performance.ltv')}
              help={t('wizard.performance.help.ltv')}
              helpTitle={t('wizard.performance.help.ltvTitle')}
              value={performance?.ltv ?? derived.ltv?.value}
              onChange={(v) => update({ ltv: v })}
              placeholder={t('wizard.performance.placeholder.ltv')}
              error={errorMessage(t, errors?.ltv)}
            />
            {derived.ltv && performance?.ltv === undefined && (
              <p className="text-xs text-muted-foreground">
                {t('wizard.performance.derived.ltv', derived.ltv.params)}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <NumberField
              htmlFor="ltv-cac"
              label={t('wizard.performance.ltvCac')}
              help={t('wizard.performance.help.ltvCac')}
              helpTitle={t('wizard.performance.help.ltvCacTitle')}
              value={performance?.ltvCacRatio ?? derived.ltvCacRatio?.value}
              onChange={(v) => update({ ltvCacRatio: v })}
              placeholder={t('wizard.performance.placeholder.ltvCac')}
              error={errorMessage(t, errors?.ltvCacRatio)}
            />
            {derived.ltvCacRatio && performance?.ltvCacRatio === undefined && (
              <p className="text-xs text-muted-foreground">
                {t('wizard.performance.derived.ltvCacRatio', derived.ltvCacRatio.params)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">{t('wizard.performance.conversion')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <NumberField
            htmlFor="conversion"
            label={t('wizard.performance.conversionRate')}
            help={t('wizard.performance.help.conversion')}
            helpTitle={t('wizard.performance.help.conversionTitle')}
            value={performance?.conversionRate}
            onChange={(v) => update({ conversionRate: v })}
            placeholder={t('wizard.performance.placeholder.conversion')}
            error={errorMessage(t, errors?.conversionRate)}
          />
          <NumberField
            htmlFor="time-to-convert"
            label={t('wizard.performance.timeToConvert')}
            help={t('wizard.performance.help.timeToConvert')}
            helpTitle={t('wizard.performance.help.timeToConvertTitle')}
            value={performance?.timeToConvert}
            onChange={(v) => update({ timeToConvert: v })}
            placeholder={t('wizard.performance.placeholder.timeToConvert')}
            error={errorMessage(t, errors?.timeToConvert)}
          />
        </div>
      </div>
    </>
  );
}
