import { useTranslation } from 'react-i18next';
import { BarChart3, FlaskConical, GitBranch, Search } from 'lucide-react';

/** The four the landing page sells. There is no fifth. */
export type Specialist = 'researcher' | 'strategist' | 'planner' | 'analyst';

const ICONS: Record<Specialist, typeof Search> = {
  researcher: Search,
  strategist: GitBranch,
  planner: FlaskConical,
  analyst: BarChart3,
};

/**
 * Which specialist is behind a given AI task.
 *
 * The landing page promises four named specialists, so the product has to name
 * them too — a founder who arrives expecting "the researcher" should not meet
 * an anonymous "generate with AI". One map, so every screen that already knows
 * its `taskType` gets the label for free.
 */
const BY_TASK: Record<string, Specialist> = {
  'research-growth-context': 'researcher',
  'propose-business-profile': 'researcher',
  'propose-business-context': 'researcher',
  'propose-context-section': 'researcher',
  'summarize-business-context': 'researcher',
  'propose-icp': 'strategist',
  'propose-goal': 'strategist',
  'propose-strategies': 'strategist',
  'propose-hypothesis': 'strategist',
  'propose-experiment': 'planner',
  'interpret-outcome': 'analyst',
};

export function specialistFor(taskType: string): Specialist | null {
  return BY_TASK[taskType] ?? null;
}

/** Who is working, and what their job is. One line, above the AI panel. */
export function SpecialistByline({ specialist }: { specialist: Specialist }) {
  const { t } = useTranslation();
  const Icon = ICONS[specialist];

  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="font-medium text-foreground">{t(`ai.specialists.${specialist}.name`)}</span>{' '}
        {t(`ai.specialists.${specialist}.role`)}
      </span>
    </p>
  );
}
