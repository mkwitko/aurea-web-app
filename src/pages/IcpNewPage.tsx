import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useGetBusiness } from '@/api/generated/hooks/businessHooks/useGetBusiness';
import { useGetBusinessContext } from '@/api/generated/hooks/businessHooks/useGetBusinessContext';
import { useCreateIcp } from '@/api/generated/hooks/icpsHooks/useCreateIcp';
import { ICPS } from '@/api/modules';
import { icpFormSchema, type IcpFormValues } from '@/schemas/icps';
import { filledSectionCount } from '@/lib/context-completeness';
import { NO_FILL_PATHS } from '@/lib/fill-paths';
import { AiFillButton } from '@/components/ai/AiFillButton';
import { PageHeader } from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextField } from '@/components/form/TextField';
import { TagsField } from '@/components/form/TagsField';

/**
 * Every field `propose-icp` can fill, all optional: the model may leave any
 * of them out. Mirrors `IcpFilled` in `back/src/ai/agents/fill/propose-icp.ts`.
 */
const icpFilledSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  painPoints: z.array(z.string()).optional(),
  characteristics: z.array(z.string()).optional(),
  customerGoals: z.array(z.string()).optional(),
  buyingTriggers: z.array(z.string()).optional(),
  objections: z.array(z.string()).optional(),
});

export function IcpNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    control,
    handleSubmit,
    setValue,
  } = useForm<IcpFormValues>({
    resolver: zodResolver(icpFormSchema),
    defaultValues: {
      name: '',
      description: '',
      painPoints: [],
      characteristics: [],
      customerGoals: [],
      buyingTriggers: [],
      objections: [],
    },
  });

  const { data: businessData } = useGetBusiness();
  const business = businessData?.business;
  const { data: contextData } = useGetBusinessContext({ query: { enabled: !!business } });
  // Same threshold the server's `precheck` refuses below — a founder should
  // never pay for a run that comes back as a refusal.
  const filledSections = filledSectionCount(contextData?.currentVersion?.data as Record<string, unknown> | undefined);

  const create = useCreateIcp({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ICPS.queryKeyRoot });
        navigate('/app/business/icps');
      },
    },
  });

  const onSubmit = handleSubmit((values) => {
    create.mutate({
      data: {
        name: values.name,
        description: values.description || undefined,
        painPoints: values.painPoints,
        characteristics: values.characteristics,
        customerGoals: values.customerGoals,
        buyingTriggers: values.buyingTriggers,
        objections: values.objections,
      },
    });
  });

  return (
    <div>
      <Link to="/app/business/icps" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('crud.back')}
      </Link>
      <PageHeader eyebrow={t('app.nav.icps')} title={t('crud.icp')} subtitle={t('pages.icps.subtitle')} />

      <div className="mb-4">
        <AiFillButton
          taskType="propose-icp"
          input={business ? { businessId: business.id } : null}
          allowedPaths={NO_FILL_PATHS}
          label={t('ai.fill.icp.label')}
          blockedReason={
            filledSections >= 3
              ? null
              : {
                  message: t('ai.fill.icp.needsContext'),
                  to: '/app/business',
                  linkLabel: t('ai.fill.icp.goToContext'),
                }
          }
          onFilled={(filled) => {
            const parsed = icpFilledSchema.safeParse(filled);
            if (!parsed.success) return;
            for (const [key, value] of Object.entries(parsed.data)) {
              if (value === undefined) continue;
              setValue(key as keyof IcpFormValues, value, { shouldDirty: true });
            }
          }}
          onAnswer={() => undefined}
        />
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={control}
                name="name"
                render={({ field, fieldState }) => (
                  <TextField
                    htmlFor="icp-name"
                    label={t('pages.icps.name')}
                    help={t('pages.icps.nameHelp')}
                    placeholder={t('pages.icps.namePh')}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
              <Controller
                control={control}
                name="description"
                render={({ field }) => (
                  <TextField
                    htmlFor="icp-desc"
                    label={t('pages.icps.description')}
                    optional
                    optionalLabel={t('common.optional')}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>

            <Controller
              control={control}
              name="painPoints"
              render={({ field, fieldState }) => (
                <TagsField
                  htmlFor="icp-pain"
                  label={t('pages.icps.painPoints')}
                  help={t('pages.icps.painPointsHelp')}
                  placeholder={t('pages.icps.painPointsPh')}
                  addLabel={t('common.add')}
                  removeLabel={(tag) => t('common.removeItem', { item: tag })}
                  value={field.value}
                  onChange={field.onChange}
                  error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                />
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={control}
                name="characteristics"
                render={({ field, fieldState }) => (
                  <TagsField
                    htmlFor="icp-characteristics"
                    label={t('pages.icps.characteristics')}
                    help={t('pages.icps.characteristicsHelp')}
                    placeholder={t('pages.icps.characteristicsPh')}
                    addLabel={t('common.add')}
                    removeLabel={(tag) => t('common.removeItem', { item: tag })}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
              <Controller
                control={control}
                name="customerGoals"
                render={({ field, fieldState }) => (
                  <TagsField
                    htmlFor="icp-customer-goals"
                    label={t('pages.icps.customerGoals')}
                    help={t('pages.icps.customerGoalsHelp')}
                    placeholder={t('pages.icps.customerGoalsPh')}
                    addLabel={t('common.add')}
                    removeLabel={(tag) => t('common.removeItem', { item: tag })}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={control}
                name="buyingTriggers"
                render={({ field, fieldState }) => (
                  <TagsField
                    htmlFor="icp-buying-triggers"
                    label={t('pages.icps.buyingTriggers')}
                    help={t('pages.icps.buyingTriggersHelp')}
                    placeholder={t('pages.icps.buyingTriggersPh')}
                    addLabel={t('common.add')}
                    removeLabel={(tag) => t('common.removeItem', { item: tag })}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
              <Controller
                control={control}
                name="objections"
                render={({ field, fieldState }) => (
                  <TagsField
                    htmlFor="icp-objections"
                    label={t('pages.icps.objections')}
                    help={t('pages.icps.objectionsHelp')}
                    placeholder={t('pages.icps.objectionsPh')}
                    addLabel={t('common.add')}
                    removeLabel={(tag) => t('common.removeItem', { item: tag })}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
            </div>
            {create.isError && <p className="text-sm text-destructive">{t('auth.error')}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? t('common.adding') : t('pages.icps.addBtn')}
              </Button>
              <Button asChild variant="ghost">
                <Link to="/app/business/icps">{t('crud.back')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
