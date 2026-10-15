import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useGetBusiness } from '@/api/generated/hooks/businessHooks/useGetBusiness';
import { useListIcps } from '@/api/generated/hooks/icpsHooks/useListIcps';
import { useCreateGoal } from '@/api/generated/hooks/goalsHooks/useCreateGoal';
import { GOALS } from '@/api/modules';
import { goalFormSchema, type GoalFormValues } from '@/schemas/goals';
import { GOAL_FILL_PATHS } from '@/lib/fill-paths';
import { AiFillButton } from '@/components/ai/AiFillButton';
import { PageHeader } from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextField } from '@/components/form/TextField';
import { TextAreaField } from '@/components/form/TextAreaField';
import { NumberField } from '@/components/form/NumberField';
import { SelectField } from '@/components/form/SelectField';

const PRIORITY = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

/**
 * Every field `propose-goal` can fill, all optional: the model may leave any
 * of them out. Mirrors `GoalFilled` in `back/src/ai/agents/fill/propose-goal.ts`.
 * `targetValue` and `deadline` are not here — the agent asks for them
 * instead (see `GOAL_FILL_PATHS`), so they arrive through `onAnswer`.
 */
const goalFilledSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  metric: z.string().optional(),
  unit: z.string().optional(),
  baselineValue: z.number().optional(),
  priority: z.enum(PRIORITY).optional(),
});

export function GoalNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    setValue,
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: '',
      description: '',
      metric: '',
      baselineValue: undefined,
      targetValue: undefined,
      unit: '',
      deadline: '',
      priority: undefined,
    },
  });

  const { data: businessData } = useGetBusiness();
  const business = businessData?.business;
  const { data: icpsData } = useListIcps();
  // Filtered here, not server-side: `GET /icps` has no status filter, and the
  // list is one workspace's worth — small enough that fetching it all and
  // narrowing here costs nothing extra.
  const activeIcp = icpsData?.icps.find((icp) => icp.status === 'ACTIVE');

  const create = useCreateGoal({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: GOALS.queryKeyRoot });
        navigate('/app/goals');
      },
    },
  });

  const onSubmit = handleSubmit((values) => {
    create.mutate({
      data: {
        name: values.name,
        description: values.description || undefined,
        metric: values.metric,
        baselineValue: values.baselineValue,
        targetValue: values.targetValue,
        unit: values.unit || undefined,
        deadline: values.deadline ? new Date(values.deadline) : undefined,
        priority: values.priority,
      },
    });
  });

  return (
    <div>
      <Link to="/app/goals" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('crud.back')}
      </Link>
      <PageHeader eyebrow={t('app.nav.goals')} title={t('crud.goal')} subtitle={t('pages.goals.subtitle')} />

      <div className="mb-4">
        <AiFillButton
          taskType="propose-goal"
          input={business && activeIcp ? { businessId: business.id, icpId: activeIcp.id } : null}
          allowedPaths={GOAL_FILL_PATHS}
          label={t('ai.fill.goal.label')}
          blockedReason={
            activeIcp
              ? null
              : {
                  message: t('ai.fill.goal.needsIcp'),
                  to: '/app/icps/new',
                  linkLabel: t('ai.fill.goal.goToIcps'),
                }
          }
          onFilled={(filled) => {
            const parsed = goalFilledSchema.safeParse(filled);
            if (!parsed.success) return;
            for (const [key, value] of Object.entries(parsed.data)) {
              if (value === undefined) continue;
              setValue(key as keyof GoalFormValues, value, { shouldDirty: true });
            }
          }}
          onAnswer={(path, value) => {
            // Converted here, not in the panel: `AiFillPanel` only ever knows
            // the answer is a `string | number`, and this form is the one
            // that knows `targetValue` is a number field and `deadline` is a
            // date-typed `TextField`.
            if (path === 'targetValue') setValue('targetValue', Number(value), { shouldDirty: true });
            else if (path === 'deadline') setValue('deadline', String(value), { shouldDirty: true });
          }}
        />
      </div>

      <Card>
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-5">
            <Controller
              control={control}
              name="name"
              render={({ field, fieldState }) => (
                <TextField
                  htmlFor="goal-name"
                  label={t('pages.goals.name')}
                  placeholder={t('pages.goals.namePh')}
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
                <TextAreaField
                  htmlFor="goal-description"
                  label={t('pages.goals.description')}
                  placeholder={t('pages.goals.descriptionPh')}
                  optional
                  optionalLabel={t('common.optional')}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />

            <div className="grid gap-5 sm:grid-cols-3">
              <Controller
                control={control}
                name="metric"
                render={({ field, fieldState }) => (
                  <TextField
                    htmlFor="goal-metric"
                    label={t('pages.goals.metric')}
                    help={t('pages.goals.metricHelp')}
                    helpTitle={t('pages.goals.metricHelpTitle')}
                    placeholder={t('pages.goals.metricPh')}
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
              <Controller
                control={control}
                name="baselineValue"
                render={({ field, fieldState }) => (
                  <NumberField
                    htmlFor="goal-baseline"
                    label={t('pages.goals.baseline')}
                    help={t('pages.goals.baselineHelp')}
                    helpTitle={t('pages.goals.baselineHelpTitle')}
                    optional
                    optionalLabel={t('common.optional')}
                    placeholder="0"
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
              <Controller
                control={control}
                name="targetValue"
                render={({ field, fieldState }) => (
                  <NumberField
                    htmlFor="goal-target"
                    label={t('pages.goals.target')}
                    help={t('pages.goals.targetHelp')}
                    helpTitle={t('pages.goals.targetHelpTitle')}
                    optional
                    optionalLabel={t('common.optional')}
                    placeholder="1000"
                    value={field.value}
                    onChange={field.onChange}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-3">
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <TextField
                    htmlFor="goal-unit"
                    label={t('pages.goals.unit')}
                    optional
                    optionalLabel={t('common.optional')}
                    placeholder={t('pages.goals.unitPh')}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="deadline"
                render={({ field }) => (
                  <TextField
                    htmlFor="goal-deadline"
                    label={t('pages.goals.deadline')}
                    type="date"
                    optional
                    optionalLabel={t('common.optional')}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                control={control}
                name="priority"
                render={({ field, fieldState }) => (
                  <SelectField
                    htmlFor="goal-priority"
                    label={t('pages.goals.priority')}
                    placeholder={t('pages.goals.prioritySelect')}
                    optional
                    optionalLabel={t('common.optional')}
                    value={field.value}
                    onChange={field.onChange}
                    options={PRIORITY.map((level) => ({ value: level, labelKey: `enums.priority.${level}` }))}
                    translate={t}
                    error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                  />
                )}
              />
            </div>
            {create.isError && <p className="text-sm text-destructive">{t('auth.error')}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? t('common.creating') : t('pages.goals.createBtn')}
              </Button>
              <Button asChild variant="ghost">
                <Link to="/app/goals">{t('crud.back')}</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
