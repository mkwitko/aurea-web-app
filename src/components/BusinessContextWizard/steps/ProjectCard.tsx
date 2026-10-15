import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { TextField } from '@/components/form/TextField';
import { TextAreaField } from '@/components/form/TextAreaField';
import { NumberField } from '@/components/form/NumberField';
import { SelectField } from '@/components/form/SelectField';
import { errorMessage } from '@/lib/zod-errors';
import { Label } from '@/components/ui/label';
import { Help } from '@/components/Help';
import { PROJECT_TYPE_OPTIONS, PROJECT_STATUS_OPTIONS } from '@/lib/enums';
import type { Project } from '@/types/business-context';
import { ObjectivesRepeater } from './ObjectivesRepeater';

interface ProjectCardProps {
  project: Project;
  update: (patch: Partial<Project>) => void;
  index: number;
  errors?: FieldErrors<Project>;
}

export function ProjectCard({ project, update, index, errors }: ProjectCardProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <TextField
          htmlFor={`project-name-${index}`}
          label={t('wizard.projects.projectName')}
          value={project.name}
          onChange={(v) => update({ name: v })}
          placeholder={t('wizard.projects.placeholder.projectName')}
          error={errorMessage(t, errors?.name)}
        />
        <SelectField
          htmlFor={`project-type-${index}`}
          label={t('wizard.projects.type')}
          value={project.type}
          onChange={(v) => update({ type: v })}
          options={PROJECT_TYPE_OPTIONS}
          placeholder={t('wizard.projects.typeSelect')}
          clearLabel={t('wizard.projects.typeSelect')}
          translate={t}
          error={errorMessage(t, errors?.type)}
        />
      </div>

      <TextAreaField
        htmlFor={`project-desc-${index}`}
        label={t('wizard.projects.description')}
        value={project.description}
        onChange={(v) => update({ description: v })}
        placeholder={t('wizard.projects.placeholder.description')}
        rows={2}
        error={errorMessage(t, errors?.description)}
      />

      <div className="grid grid-cols-3 gap-4">
        <SelectField
          htmlFor={`project-status-${index}`}
          label={t('wizard.projects.status')}
          value={project.status}
          onChange={(v) => update({ status: v })}
          options={PROJECT_STATUS_OPTIONS}
          translate={t}
          error={errorMessage(t, errors?.status)}
        />
        <NumberField
          htmlFor={`project-budget-${index}`}
          label={t('wizard.projects.budget')}
          value={project.budget}
          onChange={(v) => update({ budget: v })}
          placeholder={t('wizard.projects.placeholder.budget')}
          error={errorMessage(t, errors?.budget)}
        />
        <TextField
          htmlFor={`project-owner-${index}`}
          label={t('wizard.projects.owner')}
          value={project.owner}
          onChange={(v) => update({ owner: v })}
          placeholder={t('wizard.projects.placeholder.owner')}
          error={errorMessage(t, errors?.owner)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <TextField
          htmlFor={`project-start-${index}`}
          label={t('wizard.projects.startDate')}
          type="date"
          value={project.startDate}
          onChange={(v) => update({ startDate: v })}
          error={errorMessage(t, errors?.startDate)}
        />
        <TextField
          htmlFor={`project-end-${index}`}
          label={t('wizard.projects.endDate')}
          type="date"
          value={project.endDate}
          onChange={(v) => update({ endDate: v })}
          error={errorMessage(t, errors?.endDate)}
        />
      </div>

      <div className="space-y-4 border-t pt-4">
        <Label>
          {t('wizard.projects.objectives')}
          <Help title={t('wizard.projects.help.objectivesTitle')}>{t('wizard.projects.help.objectives')}</Help>
        </Label>
        <ObjectivesRepeater
          objectives={project.objectives}
          onChange={(objectives) => update({ objectives })}
          errors={errors?.objectives}
          projectId={project.id}
        />
      </div>
    </div>
  );
}
