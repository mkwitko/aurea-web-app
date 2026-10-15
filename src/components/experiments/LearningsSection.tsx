import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useListLearnings } from '@/api/generated/hooks/learningsHooks/useListLearnings';
import { useCreateLearning } from '@/api/generated/hooks/learningsHooks/useCreateLearning';
import { useValidateLearning } from '@/api/generated/hooks/learningsHooks/useValidateLearning';
import { useRejectLearning } from '@/api/generated/hooks/learningsHooks/useRejectLearning';
import { useArchiveLearning } from '@/api/generated/hooks/learningsHooks/useArchiveLearning';
import { LEARNINGS } from '@/api/modules';
import { allowedLearningActions, type LearningAction } from '@/lib/learning-actions';
import { apiErrorMessage } from '@/lib/api-errors';
import { learningFormSchema, type LearningFormValues } from '@/schemas/learnings';
import { Help } from '@/components/Help';
import { LifecycleActions } from '@/components/LifecycleActions';
import { SectionLoading, SectionLoadError } from '@/components/SectionState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TextField } from '@/components/form/TextField';
import { TextAreaField } from '@/components/form/TextAreaField';

/**
 * What the experiment taught, and whether a human has agreed with it yet.
 *
 * A learning arrives as a CANDIDATE and stays one until somebody validates it:
 * "Learning candidates are proposed… They are validated before becoming
 * canonical knowledge" (`docs/domains/analytics.md` §19). The status badge is
 * therefore not decoration — it is the difference between a note and knowledge
 * AUREA will reason from.
 */
export function LearningsSection({ experimentId }: { experimentId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [proposeError, setProposeError] = useState<string | null>(null);

  const learnings = useListLearnings({ experimentId });

  const refresh = () => queryClient.invalidateQueries({ queryKey: LEARNINGS.queryKeyRoot });

  const { control, handleSubmit, reset } = useForm<LearningFormValues>({
    resolver: zodResolver(learningFormSchema),
    defaultValues: { title: '', statement: '' },
  });

  const propose = useCreateLearning({
    mutation: {
      onMutate: () => setProposeError(null),
      onSuccess: async () => {
        reset();
        await refresh();
      },
      onError: (error) => setProposeError(apiErrorMessage(error, t('pages.experiments.learnings.proposeFailed'))),
    },
  });

  // Every move refetches instead of patching the row from the button that was
  // pressed: the mirror in `lib/learning-actions` can be stale, and it is the
  // server's answer that says what actually happened.
  const mutation = {
    onMutate: () => setActionError(null),
    onSuccess: async () => {
      await refresh();
    },
    onError: (error: unknown) =>
      setActionError(apiErrorMessage(error, t('pages.experiments.learnings.actionFailed'))),
  };

  const validate = useValidateLearning({ mutation });
  const reject = useRejectLearning({ mutation });
  const archive = useArchiveLearning({ mutation });

  const byAction: Record<LearningAction, { mutate: (vars: { id: string }) => void; isPending: boolean }> = {
    validate,
    reject,
    archive,
  };
  const pending = Object.values(byAction).some((entry) => entry.isPending);

  const onSubmit = handleSubmit((values) => {
    propose.mutate({ data: { experimentId, title: values.title, statement: values.statement } });
  });

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="text-sm font-medium">
          {t('pages.experiments.learnings.title')}
          <Help title={t('pages.experiments.learnings.helpTitle')}>{t('pages.experiments.learnings.help')}</Help>
        </p>

        {learnings.isLoading && <SectionLoading />}
        {(learnings.isError || (!learnings.isLoading && !learnings.data)) && (
          <SectionLoadError refetch={[learnings.refetch]} />
        )}

        {learnings.data &&
          (learnings.data.learnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('pages.experiments.learnings.empty')}</p>
          ) : (
            <ul className="space-y-4">
              {learnings.data.learnings.map((learning) => (
                <li key={learning.id} className="border-l-2 border-primary/40 pl-3">
                  <p className="text-sm font-medium">{learning.title}</p>
                  <p className="text-sm text-muted-foreground">{learning.statement}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="muted">{t(`status.${learning.status}`)}</Badge>
                    <LifecycleActions
                      moves={allowedLearningActions(learning.status)}
                      labelKey="pages.experiments.learnings.action"
                      pending={pending}
                      onAct={(action) => byAction[action].mutate({ id: learning.id })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        <form onSubmit={onSubmit} className="space-y-4 border-t pt-4">
          <Controller
            control={control}
            name="title"
            render={({ field, fieldState }) => (
              <TextField
                htmlFor="learning-title"
                label={t('pages.experiments.learnings.titleLabel')}
                placeholder={t('pages.experiments.learnings.titlePh')}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              />
            )}
          />
          <Controller
            control={control}
            name="statement"
            render={({ field, fieldState }) => (
              <TextAreaField
                htmlFor="learning-statement"
                label={t('pages.experiments.learnings.statementLabel')}
                placeholder={t('pages.experiments.learnings.statementPh')}
                value={field.value}
                onChange={field.onChange}
                error={fieldState.error?.message ? t(fieldState.error.message) : undefined}
              />
            )}
          />

          {proposeError && <p className="text-sm text-destructive">{proposeError}</p>}

          <Button type="submit" size="sm" disabled={propose.isPending}>
            {propose.isPending ? t('common.saving') : t('pages.experiments.learnings.proposeBtn')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
