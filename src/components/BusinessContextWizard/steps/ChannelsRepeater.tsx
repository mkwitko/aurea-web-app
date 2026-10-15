import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { NumberField } from '@/components/form/NumberField';
import { TextField } from '@/components/form/TextField';
import { Repeater } from '@/components/form/Repeater';
import { errorMessage } from '@/lib/zod-errors';
import type { ChannelPerformance, CurrentPerformance } from '@/types/business-context';

interface ChannelsRepeaterProps {
  channels: ChannelPerformance[] | undefined;
  onChange: (channels: ChannelPerformance[]) => void;
  /**
   * Not in the original interface this component was speced against — added
   * because global rule 6 ("every primitive gets `error`, no exceptions")
   * applies to this repeater's fields exactly like it does to
   * CompetitorCard/ProductCard, and `channel` has a reachable error: an added
   * row left with a blank name has its `channel` key stripped entirely by
   * `dropBlankFields` before `safeParse` runs (blank strings are dropped, not
   * sent as `''`), so the schema sees the key missing and reports
   * `invalid_type`, not `too_small` — a required string with no default is
   * absent, not empty, from Zod's point of view. Typed off
   * `FieldErrors<CurrentPerformance>['channels']` rather than
   * `FieldErrors<ChannelPerformance>[]` because react-hook-form's array error
   * type also carries a root-level `FieldError` (e.g. a `min(1)` on the array
   * itself), which a plain array type can't express.
   */
  errors?: FieldErrors<CurrentPerformance>['channels'];
}

export function ChannelsRepeater({ channels, onChange, errors }: ChannelsRepeaterProps) {
  const { t } = useTranslation();

  return (
    <Repeater<ChannelPerformance>
      items={channels}
      onChange={onChange}
      newItem={() => ({ channel: '' })}
      itemLabel={(index) => t('wizard.performance.channelN', { n: index + 1 })}
      addLabel={t('wizard.performance.addChannel')}
      removeLabel={t('wizard.performance.remove')}
      renderItem={(channel, update, index) => {
        const itemErrors = errors?.[index];
        return (
          <div className="grid grid-cols-2 gap-4">
            <TextField
              htmlFor={`channel-name-${index}`}
              label={t('wizard.performance.channelName')}
              value={channel.channel}
              onChange={(v) => update({ channel: v })}
              placeholder={t('wizard.performance.placeholder.channelName')}
              error={errorMessage(t, itemErrors?.channel)}
            />
            <NumberField
              htmlFor={`channel-visitors-${index}`}
              label={t('wizard.performance.monthlyVisitors')}
              value={channel.monthlyVisitors}
              onChange={(v) => update({ monthlyVisitors: v })}
              placeholder={t('wizard.performance.placeholder.visitors')}
              error={errorMessage(t, itemErrors?.monthlyVisitors)}
            />
            <NumberField
              htmlFor={`channel-conversion-${index}`}
              label={t('wizard.performance.channelConversion')}
              help={t('wizard.performance.help.conversion')}
              helpTitle={t('wizard.performance.help.conversionTitle')}
              value={channel.conversionRate}
              onChange={(v) => update({ conversionRate: v })}
              placeholder={t('wizard.performance.placeholder.channelConversion')}
              error={errorMessage(t, itemErrors?.conversionRate)}
            />
            <NumberField
              htmlFor={`channel-cac-${index}`}
              label={t('wizard.performance.channelCac')}
              help={t('wizard.performance.help.cac')}
              helpTitle={t('wizard.performance.help.cacTitle')}
              value={channel.cac}
              onChange={(v) => update({ cac: v })}
              placeholder={t('wizard.performance.placeholder.channelCac')}
              error={errorMessage(t, itemErrors?.cac)}
            />
          </div>
        );
      }}
    />
  );
}
