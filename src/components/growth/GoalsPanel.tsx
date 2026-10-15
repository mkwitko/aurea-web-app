import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useListGoals } from '@/api/generated/hooks/goalsHooks/useListGoals';
import { useActivateGoal } from '@/api/generated/hooks/goalsHooks/useActivateGoal';
import { usePauseGoal } from '@/api/generated/hooks/goalsHooks/usePauseGoal';
import { useCompleteGoal } from '@/api/generated/hooks/goalsHooks/useCompleteGoal';
import { useCancelGoal } from '@/api/generated/hooks/goalsHooks/useCancelGoal';
import { GOALS, DASHBOARD } from '@/api/modules';
import { allowedGoalActions, type GoalAction } from '@/lib/goal-actions';
import { LifecycleActions } from '@/components/LifecycleActions';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const statusVariant: Record<string, 'default' | 'success' | 'muted'> = {
  ACTIVE: 'success',
  DRAFT: 'muted',
  COMPLETED: 'default',
};

/** The goal list and its lifecycle actions, shared by the standalone page and GrowthPage. */
export function GoalsPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading } = useListGoals();
  const goals = data?.goals ?? [];

  // O dashboard conta objetivos, então ele fica velho no instante em que um
  // muda de status — mesma razão pela qual o delete de business invalida os
  // dois. Uma função só para as quatro mutações: o que muda entre elas é a
  // rota, não o que fica obsoleto.
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: GOALS.queryKeyRoot }),
      queryClient.invalidateQueries({ queryKey: DASHBOARD.queryKeyRoot }),
    ]);
  };
  const onSuccess = () => void refresh();

  const activate = useActivateGoal({ mutation: { onSuccess } });
  const pause = usePauseGoal({ mutation: { onSuccess } });
  const complete = useCompleteGoal({ mutation: { onSuccess } });
  const cancel = useCancelGoal({ mutation: { onSuccess } });

  const pending = activate.isPending || pause.isPending || complete.isPending || cancel.isPending;

  const act = (id: string, action: GoalAction) => {
    const run = { activate, pause, complete, cancel }[action];
    run.mutate({ id });
  };

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {goals.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">{t('pages.goals.empty')}</CardContent>
        </Card>
      )}
      {goals.map((g) => (
        <Card key={g.id} className="card-tech">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-medium">
                <span className="truncate">{g.name}</span>
                <Badge variant={statusVariant[g.status] ?? 'muted'}>{t(`status.${g.status}`)}</Badge>
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground">
                {g.metric}
                {g.targetValue != null && ` → ${g.targetValue}${g.unit ? ` ${g.unit}` : ''}`}
              </div>
            </div>
            <LifecycleActions
              moves={allowedGoalActions(g.status)}
              labelKey="pages.goals.action"
              pending={pending}
              onAct={(action) => act(g.id, action)}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
