import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useCreateStrategy } from '@/api/generated/hooks/strategiesHooks/useCreateStrategy';
import { useListGoals } from '@/api/generated/hooks/goalsHooks/useListGoals';
import { STRATEGIES } from '@/api/modules';
import { strategyFormSchema, type StrategyFormValues } from '@/schemas/strategies';
import { PageHeader } from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextField } from '@/components/form/TextField';
import { SelectField } from '@/components/form/SelectField';

export function StrategyNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: goalsData, isLoading } = useListGoals();
  const goals = goalsData?.goals ?? [];

  const {
    control,
    handleSubmit,
  } = useForm<StrategyFormValues>({
    resolver: zodResolver(strategyFormSchema),
    defaultValues: { name: '', goalId: '', growthMechanism: '' },
  });

  const create = useCreateStrategy({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: STRATEGIES.queryKeyRoot });
        navigate('/app/strategies');
      },
    },
  });

  const onSubmit = handleSubmit((values) => {
    create.mutate({
      data: { name: values.name, goalIds: [values.goalId], growthMechanism: values.growthMechanism || undefined },
    });
  });

  return (
    <div>
      <Link to="/app/strategies" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('crud.back')}
      </Link>
      <PageHeader eyebrow={t('app.nav.strategies')} title={t('crud.strategy')} subtitle={t('pages.strategies.subtitle')} />

      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
            </p>
          ) : goals.length === 0 ? (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>{t('pages.strategies.needGoal')}</p>
              <Button asChild>
                <Link to="/app/goals/new">{t('crud.goal')}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Controller
                  control={control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <TextField
                      htmlFor="strategy-name"
                      label={t('pages.strategies.name')}
                      placeholder={t('pages.strategies.namePh')}
                      value={field.value}
                      onChange={field.onChange}
                      error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="goalId"
                  render={({ field, fieldState }) => (
                    <SelectField
                      htmlFor="strategy-goal"
                      label={t('pages.strategies.goal')}
                      help={t('pages.strategies.goalHelp')}
                      placeholder={t('pages.strategies.goalSelect')}
                      value={field.value || undefined}
                      onChange={(v) => field.onChange(v ?? '')}
                      options={goals.map((g) => ({ value: g.id, labelKey: g.name }))}
                      translate={(label) => label}
                      error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
                    />
                  )}
                />
              </div>
              <Controller
                control={control}
                name="growthMechanism"
                render={({ field }) => (
                  <TextField
                    htmlFor="strategy-mechanism"
                    label={t('pages.strategies.mechanism')}
                    help={t('pages.strategies.mechanismHelp')}
                    helpTitle={t('pages.strategies.mechanismHelpTitle')}
                    placeholder={t('pages.strategies.mechanismPh')}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {create.isError && <p className="text-sm text-destructive">{t('auth.error')}</p>}
              <div className="flex gap-3">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? t('common.creating') : t('pages.strategies.createBtn')}
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/app/strategies">{t('crud.back')}</Link>
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
