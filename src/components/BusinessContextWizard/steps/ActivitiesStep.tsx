import { Trans, useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { NumberField } from '@/components/form/NumberField';
import { TagsField } from '@/components/form/TagsField';
import { errorMessage } from '@/lib/zod-errors';
import { Help } from '@/components/Help';
import type { BusinessContextData, CurrentActivities } from '@/types/business-context';

interface ActivitiesStepProps {
  data: BusinessContextData;
  onChange: (data: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export function ActivitiesStep({ data, onChange, errors }: ActivitiesStepProps) {
  const { t } = useTranslation();
  const activities = data.currentActivities;
  const fieldErrors = errors?.currentActivities;

  const update = (patch: Partial<CurrentActivities>) =>
    onChange({
      currentActivities: {
        activeChannels: activities?.activeChannels ?? [],
        contentProduction: activities?.contentProduction,
        paidAdvertising: activities?.paidAdvertising,
        partnerships: activities?.partnerships ?? [],
        other: activities?.other ?? [],
        ...patch,
      },
    });

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('wizard.activities.intro')}</p>

      <TagsField
        htmlFor="active-channels"
        label={t('wizard.activities.activeChannels')}
        help={t('wizard.activities.help.channels')}
        helpTitle={t('wizard.activities.help.channelsTitle')}
        value={activities?.activeChannels}
        onChange={(v) => update({ activeChannels: v })}
        placeholder={t('wizard.activities.placeholder.addChannel')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.activeChannels)}
      />

      <div className="space-y-4">
        <h3 className="font-semibold">
          {t('wizard.activities.contentProduction')}
          <Help title={t('wizard.activities.help.contentTitle')}>{t('wizard.activities.help.content')}</Help>
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <NumberField
            htmlFor="blog-posts"
            label={t('wizard.activities.blogPosts')}
            value={activities?.contentProduction?.blogPostsPerMonth}
            onChange={(v) =>
              update({ contentProduction: { ...activities?.contentProduction, blogPostsPerMonth: v } })
            }
            placeholder={t('wizard.activities.placeholder.blogPosts')}
            error={errorMessage(t, fieldErrors?.contentProduction?.blogPostsPerMonth)}
          />
          <NumberField
            htmlFor="social-posts"
            label={t('wizard.activities.socialPosts')}
            value={activities?.contentProduction?.socialPostsPerWeek}
            onChange={(v) =>
              update({ contentProduction: { ...activities?.contentProduction, socialPostsPerWeek: v } })
            }
            placeholder={t('wizard.activities.placeholder.socialPosts')}
            error={errorMessage(t, fieldErrors?.contentProduction?.socialPostsPerWeek)}
          />
          <NumberField
            htmlFor="email-campaigns"
            label={t('wizard.activities.emailCampaigns')}
            value={activities?.contentProduction?.emailCampaignsPerMonth}
            onChange={(v) =>
              update({ contentProduction: { ...activities?.contentProduction, emailCampaignsPerMonth: v } })
            }
            placeholder={t('wizard.activities.placeholder.emailCampaigns')}
            error={errorMessage(t, fieldErrors?.contentProduction?.emailCampaignsPerMonth)}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">
          {t('wizard.activities.paidAdvertising')}
          <Help title={t('wizard.activities.help.paidTitle')}>{t('wizard.activities.help.paid')}</Help>
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <TagsField
            htmlFor="ad-platforms"
            label={t('wizard.activities.adPlatforms')}
            value={activities?.paidAdvertising?.platforms}
            onChange={(v) => update({ paidAdvertising: { ...activities?.paidAdvertising, platforms: v } })}
            placeholder={t('wizard.activities.placeholder.adPlatforms')}
            addLabel={t('common.add')}
            removeLabel={(tag) => t('common.removeItem', { item: tag })}
            error={errorMessage(t, fieldErrors?.paidAdvertising?.platforms)}
          />
          <NumberField
            htmlFor="ad-spend"
            label={t('wizard.activities.monthlyAdSpend')}
            value={activities?.paidAdvertising?.monthlySpend}
            onChange={(v) => update({ paidAdvertising: { ...activities?.paidAdvertising, monthlySpend: v } })}
            placeholder={t('wizard.activities.placeholder.adSpend')}
            error={errorMessage(t, fieldErrors?.paidAdvertising?.monthlySpend)}
          />
        </div>
      </div>

      <TagsField
        htmlFor="partnerships"
        label={t('wizard.activities.partnerships')}
        help={t('wizard.activities.help.partnerships')}
        helpTitle={t('wizard.activities.help.partnershipsTitle')}
        value={activities?.partnerships}
        onChange={(v) => update({ partnerships: v })}
        placeholder={t('wizard.activities.placeholder.addPartnership')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.partnerships)}
      />

      <TagsField
        htmlFor="other-activities"
        label={t('wizard.activities.other')}
        help={t('wizard.activities.help.other')}
        helpTitle={t('wizard.activities.help.otherTitle')}
        value={activities?.other}
        onChange={(v) => update({ other: v })}
        placeholder={t('wizard.activities.placeholder.addOther')}
        addLabel={t('common.add')}
        removeLabel={(tag) => t('common.removeItem', { item: tag })}
        error={errorMessage(t, fieldErrors?.other)}
      />

      <div className="text-sm text-muted-foreground mt-4">
        <Trans i18nKey="wizard.activities.tip" components={{ strong: <strong /> }} />
      </div>

      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <p className="text-sm font-medium mb-2">{t('wizard.activities.doneTitle')}</p>
        <p className="text-sm text-muted-foreground">
          <Trans i18nKey="wizard.activities.doneMessage" components={{ strong: <strong /> }} />
        </p>
      </div>
    </div>
  );
}
