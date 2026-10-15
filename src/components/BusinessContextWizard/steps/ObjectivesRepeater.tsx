import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { TextField } from '@/components/form/TextField';
import { NumberField } from '@/components/form/NumberField';
import { SelectField } from '@/components/form/SelectField';
import { Repeater } from '@/components/form/Repeater';
import { errorMessage } from '@/lib/zod-errors';
import { OBJECTIVE_STATUS_OPTIONS } from '@/lib/enums';
import { EMPTY_PROJECT_OBJECTIVE, type Project, type ProjectObjective } from '@/types/business-context';

interface ObjectivesRepeaterProps {
  objectives: ProjectObjective[] | undefined;
  onChange: (objectives: ProjectObjective[]) => void;
  /**
   * Typed off `FieldErrors<Project>['objectives']` rather than
   * `FieldErrors<ProjectObjective>[]`, same reasoning as `ChannelsRepeater`:
   * react-hook-form's array error type also carries a root-level `FieldError`
   * that a plain array type can't express.
   */
  errors?: FieldErrors<Project>['objectives'];
  /**
   * The parent project's stable id. `ProjectsStep` renders every project card
   * at once (no accordion), so a local `index` alone collides across
   * siblings — two projects each with a first objective would both emit
   * `id="objective-desc-0"`, and `htmlFor`/`aria-describedby` would resolve to
   * whichever one is first in the DOM. Prefixing every id with the owning
   * project's id keeps every objective's ids unique across the whole page.
   */
  projectId: string;
}

export function ObjectivesRepeater({ objectives, onChange, errors, projectId }: ObjectivesRepeaterProps) {
  const { t } = useTranslation();

  return (
    <Repeater<ProjectObjective>
      items={objectives}
      onChange={onChange}
      newItem={() => ({ id: nanoid(), ...EMPTY_PROJECT_OBJECTIVE })}
      itemLabel={(index) => t('wizard.projects.objectiveN', { n: index + 1 })}
      addLabel={t('wizard.projects.addObjective')}
      removeLabel={t('wizard.projects.remove')}
      renderItem={(objective, update, index) => {
        const itemErrors = errors?.[index];
        return (
          <div className="space-y-3">
            <TextField
              htmlFor={`project-${projectId}-objective-desc-${index}`}
              label={t('wizard.projects.objDescription')}
              value={objective.description}
              onChange={(v) => update({ description: v })}
              placeholder={t('wizard.projects.placeholder.objDescription')}
              error={errorMessage(t, itemErrors?.description)}
            />
            <div className="grid grid-cols-4 gap-2">
              <TextField
                htmlFor={`project-${projectId}-objective-metric-${index}`}
                label={t('wizard.projects.metric')}
                help={t('wizard.projects.help.metric')}
                helpTitle={t('wizard.projects.help.metricTitle')}
                value={objective.metric}
                onChange={(v) => update({ metric: v })}
                placeholder={t('wizard.projects.placeholder.metric')}
                error={errorMessage(t, itemErrors?.metric)}
              />
              <NumberField
                htmlFor={`project-${projectId}-objective-baseline-${index}`}
                label={t('wizard.projects.baseline')}
                help={t('wizard.projects.help.baseline')}
                helpTitle={t('wizard.projects.help.baselineTitle')}
                value={objective.baseline}
                onChange={(v) => update({ baseline: v })}
                placeholder={t('wizard.projects.placeholder.baseline')}
                error={errorMessage(t, itemErrors?.baseline)}
              />
              <NumberField
                htmlFor={`project-${projectId}-objective-target-${index}`}
                label={t('wizard.projects.target')}
                help={t('wizard.projects.help.target')}
                helpTitle={t('wizard.projects.help.targetTitle')}
                value={objective.target}
                onChange={(v) => update({ target: v })}
                placeholder={t('wizard.projects.placeholder.target')}
                error={errorMessage(t, itemErrors?.target)}
              />
              <TextField
                htmlFor={`project-${projectId}-objective-unit-${index}`}
                label={t('wizard.projects.unit')}
                value={objective.unit}
                onChange={(v) => update({ unit: v })}
                placeholder={t('wizard.projects.placeholder.unit')}
                error={errorMessage(t, itemErrors?.unit)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField
                htmlFor={`project-${projectId}-objective-deadline-${index}`}
                label={t('wizard.projects.deadline')}
                type="date"
                value={objective.deadline}
                onChange={(v) => update({ deadline: v })}
                error={errorMessage(t, itemErrors?.deadline)}
              />
              <SelectField
                htmlFor={`project-${projectId}-objective-status-${index}`}
                label={t('wizard.projects.objStatus')}
                value={objective.status}
                onChange={(v) => update({ status: v })}
                options={OBJECTIVE_STATUS_OPTIONS}
                translate={t}
                error={errorMessage(t, itemErrors?.status)}
              />
            </div>
          </div>
        );
      }}
    />
  );
}
