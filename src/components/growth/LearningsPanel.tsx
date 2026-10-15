import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useListLearnings } from '@/api/generated/hooks/learningsHooks/useListLearnings';
import { useListExperiments } from '@/api/generated/hooks/experimentsHooks/useListExperiments';
import type { ListLearningsQueryParamsStatusEnumKey } from '@/api/generated/types/ListLearnings';
import { Card, CardContent } from '@/components/ui/card';

const FILTERS = ['CANDIDATE', 'VALIDATED', 'REJECTED', 'ARCHIVED'] as const;

/**
 * Every learning this workspace holds, in one place.
 *
 * The per-experiment list answers "what did this test teach"; this answers
 * "what do we know", which is the question the next decision starts from — and
 * the one the proposal agents now read through `get_learnings`.
 *
 * Shared by the standalone page and GrowthPage.
 */
export function LearningsPanel() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<ListLearningsQueryParamsStatusEnumKey | null>(null);

  const { data, isLoading } = useListLearnings(status ? { status } : undefined);
  // The learnings list carries `experimentId` but no name, so the experiments
  // are read once and used as a lookup rather than one request per row.
  const experiments = useListExperiments();
  const nameById = new Map((experiments.data?.experiments ?? []).map((e) => [e.id, e.name]));

  const learnings = data?.learnings ?? [];
  const formatDate = (value: Date | string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('pages.learnings.filterLabel')}</span>
        {[null, ...FILTERS].map((option) => {
          const isActive = option === status;
          return (
            <button
              key={option ?? 'all'}
              type="button"
              aria-pressed={isActive}
              onClick={() => setStatus(option)}
              className={
                isActive
                  ? 'rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground'
                  : 'rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent'
              }
            >
              {option === null ? t('pages.learnings.filterAll') : t(`status.${option}`)}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> {t('common.loading')}
        </p>
      ) : learnings.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t('pages.learnings.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {learnings.map((learning) => (
            <Card key={learning.id} className="card-tech">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{learning.title}</span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {t(`status.${learning.status}`)} · {t(`enums.confidence.${learning.confidence}`)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{learning.statement}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatDate(learning.createdAt)}</span>
                  {learning.experimentId ? (
                    <Link to={`/app/experiments/${learning.experimentId}`} className="underline">
                      {t('pages.learnings.fromExperiment', {
                        name: nameById.get(learning.experimentId) ?? t('pages.learnings.openExperiment'),
                      })}
                    </Link>
                  ) : (
                    <span>{t('pages.learnings.manual')}</span>
                  )}
                  {/* Only validated learnings reach the proposal agents, so only
                      they may claim they shape what comes next. */}
                  {learning.status === 'VALIDATED' && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                      {t('pages.learnings.countedIn')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
