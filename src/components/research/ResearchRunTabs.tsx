import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { GetAgentRun200StatusEnumKey } from '@/api/generated/types/GetAgentRun';
import { parseRunGoalId } from '@/schemas/strategy-proposal';

export interface RunTab {
  id: string;
  status: GetAgentRun200StatusEnumKey;
  /**
   * Unknown on the wire, same as `output` — parsed, never cast. Optional
   * because the generated list type says so: a run whose input was never
   * written still has to render as a tab.
   */
  input?: unknown;
}

interface ResearchRunTabsProps {
  runs: RunTab[];
  goals: { id: string; name: string }[];
  /** Null while the picker is open: no run is being reviewed. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  /** The picker is what is on screen, so the "new research" tab is the current one. */
  picking: boolean;
}

/**
 * Every research this workspace has going, side by side.
 *
 * The screen used to adopt exactly one run — the newest — and gave the founder
 * no way to reach any other, so researching a second goal meant losing sight of
 * the first: an in-flight run took over the whole panel until it finished. The
 * backend never had that limit (concurrency is keyed per task + input, so two
 * goals never block each other), it was only ever a limit of this screen.
 *
 * Status comes from the list, not from the run being open, so a research that
 * finishes in another tab announces itself here.
 */
export function ResearchRunTabs({ runs, goals, selectedId, onSelect, onNew, picking }: ResearchRunTabsProps) {
  const { t } = useTranslation();

  // Resolvido contra todos os objetivos, não só os ACTIVE: um objetivo que
  // desde então foi pausado ou concluído continua sendo o objetivo daquela
  // pesquisa. Sem resolver, o rótulo diz isso em vez de mostrar um uuid.
  const label = (run: RunTab) => {
    const goalId = parseRunGoalId(run.input);
    return goals.find((goal) => goal.id === goalId)?.name ?? t('pages.research.unnamedRun');
  };

  const state = (status: GetAgentRun200StatusEnumKey) => {
    if (status === 'COMPLETED') return { key: 'ready', dot: 'bg-primary' };
    if (status === 'FAILED' || status === 'CANCELLED') return { key: 'failed', dot: 'bg-destructive' };
    return { key: 'running', dot: 'bg-amber-500 animate-pulse' };
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('pages.research.runsLabel')}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {runs.map((run) => {
          const { key, dot } = state(run.status);
          const selected = run.id === selectedId;
          return (
            <button
              key={run.id}
              type="button"
              aria-current={selected ? 'true' : undefined}
              onClick={() => onSelect(run.id)}
              className={[
                'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors',
                selected ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted',
              ].join(' ')}
            >
              <span className={['size-2 rounded-full', dot].join(' ')} aria-hidden="true" />
              <span>{label(run)}</span>
              <span className="text-xs text-muted-foreground">{t(`pages.research.runStatus.${key}`)}</span>
            </button>
          );
        })}

        <button
          type="button"
          aria-current={picking ? 'true' : undefined}
          onClick={onNew}
          className={[
            'flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm transition-colors',
            picking ? 'border-primary bg-primary/10 font-medium' : 'border-border hover:bg-muted',
          ].join(' ')}
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('pages.research.newResearchBtn')}
        </button>
      </div>
    </div>
  );
}
