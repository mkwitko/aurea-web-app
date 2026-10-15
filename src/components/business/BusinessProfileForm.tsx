import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useGetBusiness } from '@/api/generated/hooks/businessHooks/useGetBusiness';
import { useCreateBusiness } from '@/api/generated/hooks/businessHooks/useCreateBusiness';
import { useUpdateBusiness } from '@/api/generated/hooks/businessHooks/useUpdateBusiness';
import { BUSINESS } from '@/api/modules';
import { businessFormSchema, BUSINESS_LIMITS, type BusinessFormValues } from '@/schemas/business';
import { NO_FILL_PATHS } from '@/lib/fill-paths';
import { AiFillButton } from '@/components/ai/AiFillButton';
import { CharCount } from '@/components/form/CharCount';
import { Help } from '@/components/Help';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * The six fields `propose-business-profile` can fill from the website, all
 * optional: the model may leave any of them out rather than guess. A local
 * schema (not `businessFormSchema`) because it validates only the slice an AI
 * run can plausibly return — `name` has no business being filled from a
 * website scrape, and `website` is the input, not an output.
 */
const businessProfileFilledSchema = z.object({
  description: z.string().optional(),
  industry: z.string().optional(),
  businessModel: z.string().optional(),
  revenueModel: z.string().optional(),
  valueProposition: z.string().optional(),
  positioning: z.string().optional(),
});

/**
 * The create/edit form for the business's base fields, shared by the
 * standalone setup page (onboarding step 1) and the "profile" tab of the
 * merged business page.
 */
export function BusinessProfileForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useGetBusiness();
  const existing = data?.business;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BusinessFormValues>({
    resolver: zodResolver(businessFormSchema),
    defaultValues: {
      name: '',
      website: '',
      industry: '',
      description: '',
      businessModel: '',
      revenueModel: '',
      valueProposition: '',
      positioning: '',
    },
  });

  // O formulário inteiro é observado porque cada contador precisa do tamanho
  // atual do seu campo — inclusive quando o valor vem de `setValue` da IA.
  const values = watch();
  const website = values.website;

  useEffect(() => {
    if (!existing) return;
    reset({
      name: existing.name,
      website: existing.website ?? '',
      industry: existing.industry ?? '',
      description: existing.description ?? '',
      businessModel: existing.businessModel ?? '',
      revenueModel: existing.revenueModel ?? '',
      valueProposition: existing.valueProposition ?? '',
      positioning: existing.positioning ?? '',
    });
  }, [existing, reset]);

  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: BUSINESS.queryKeyRoot });
    navigate('/app/business');
  };

  const create = useCreateBusiness({ mutation: { onSuccess } });
  const update = useUpdateBusiness({ mutation: { onSuccess } });
  const pending = create.isPending || update.isPending;
  const failed = create.isError || update.isError;

  const onSubmit = handleSubmit((values) => {
    const payload = {
      name: values.name,
      website: values.website || undefined,
      industry: values.industry || undefined,
      description: values.description || undefined,
      businessModel: values.businessModel || undefined,
      revenueModel: values.revenueModel || undefined,
      valueProposition: values.valueProposition || undefined,
      positioning: values.positioning || undefined,
    };
    if (existing) update.mutate({ data: payload });
    else create.mutate({ data: payload });
  });

  const err = (key?: string) => (key ? t(key) : undefined);

  /** Rodapé de um campo com teto: erro à esquerda, "usados / limite" à direita. */
  const footer = (field: keyof typeof BUSINESS_LIMITS) => (
    <div className="flex items-start justify-between gap-3">
      {errors[field] ? (
        <p className="text-sm text-destructive">{err(errors[field]?.message)}</p>
      ) : (
        <span />
      )}
      <CharCount value={values[field]} max={BUSINESS_LIMITS[field]} />
    </div>
  );

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <AiFillButton
          taskType="propose-business-profile"
          input={existing?.id && website ? { businessId: existing.id, website } : null}
          allowedPaths={NO_FILL_PATHS}
          label={t('ai.fill.business.label')}
          blockedReason={website ? null : { message: t('ai.fill.business.needsWebsite') }}
          onFilled={(filled) => {
            const parsed = businessProfileFilledSchema.safeParse(filled);
            if (!parsed.success) return;
            for (const [key, value] of Object.entries(parsed.data)) {
              setValue(key as keyof BusinessFormValues, value, { shouldDirty: true });
            }
          }}
          onAnswer={() => undefined}
        />
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">{t('pages.business.setup.name')}</Label>
              <Input
                id="name"
                maxLength={BUSINESS_LIMITS.name}
                placeholder={t('pages.business.setup.namePh')}
                {...register('name')}
              />
              {footer('name')}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="website">
                  {t('pages.business.setup.website')}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{t('common.optional')}</span>
                </Label>
                <Input id="website" placeholder="https://" {...register('website')} />
                {errors.website && <p className="text-sm text-destructive">{err(errors.website.message)}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">
                  {t('pages.business.setup.industry')}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{t('common.optional')}</span>
                </Label>
                <Input
                  id="industry"
                  maxLength={BUSINESS_LIMITS.industry}
                  placeholder={t('pages.business.setup.industryPh')}
                  {...register('industry')}
                />
                {footer('industry')}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                {t('pages.business.setup.description')}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{t('common.optional')}</span>
              </Label>
              <Textarea
                id="description"
                rows={2}
                maxLength={BUSINESS_LIMITS.description}
                placeholder={t('pages.business.setup.descriptionPh')}
                {...register('description')}
              />
              {footer('description')}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessModel">
                  {t('pages.business.setup.businessModel')}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{t('common.optional')}</span>
                </Label>
                <Input
                  id="businessModel"
                  maxLength={BUSINESS_LIMITS.businessModel}
                  placeholder={t('pages.business.setup.businessModelPh')}
                  {...register('businessModel')}
                />
                {footer('businessModel')}
              </div>
              <div className="space-y-2">
                <Label htmlFor="revenueModel">
                  {t('pages.business.setup.revenueModel')}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{t('common.optional')}</span>
                </Label>
                <Input
                  id="revenueModel"
                  maxLength={BUSINESS_LIMITS.revenueModel}
                  placeholder={t('pages.business.setup.revenueModelPh')}
                  {...register('revenueModel')}
                />
                {footer('revenueModel')}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valueProposition">
                {t('pages.business.setup.valueProposition')}
                <Help>{t('wizard.company.help.valueProposition')}</Help>
              </Label>
              <Textarea
                id="valueProposition"
                rows={2}
                maxLength={BUSINESS_LIMITS.valueProposition}
                placeholder={t('pages.business.setup.valuePropositionPh')}
                {...register('valueProposition')}
              />
              {footer('valueProposition')}
            </div>

            {/* Aberto quando o campo dentro dele está inválido: um erro escondido
                atrás do summary é um submit que falha sem explicação. */}
            <details className="rounded-lg border px-4 py-3" open={Boolean(errors.positioning)}>
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground marker:text-muted-foreground">
                {t('pages.business.setup.advanced')}
              </summary>
              <div className="mt-4 space-y-2">
                <Label htmlFor="positioning">
                  {t('pages.business.setup.positioning')}
                  <Help>{t('wizard.company.help.positioning')}</Help>
                </Label>
                <Textarea
                  id="positioning"
                  rows={2}
                  maxLength={BUSINESS_LIMITS.positioning}
                  placeholder={t('pages.business.setup.positioningPh')}
                  {...register('positioning')}
                />
                {footer('positioning')}
              </div>
            </details>

            {failed && <p className="text-sm text-destructive">{t('pages.business.saveFailed')}</p>}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={pending}>
                {pending ? t('common.saving') : existing ? t('common.save') : t('pages.business.setup.submit')}
              </Button>
              <Button asChild variant="ghost">
                <Link to="/app/business">{t('common.cancel')}</Link>
              </Button>
            </div>

            {!existing && <p className="text-xs text-muted-foreground">{t('pages.business.setup.afterHint')}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
