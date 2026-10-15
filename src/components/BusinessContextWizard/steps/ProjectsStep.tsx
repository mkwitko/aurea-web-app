import { nanoid } from 'nanoid';
import { useTranslation } from 'react-i18next';
import type { FieldErrors } from 'react-hook-form';
import { Repeater } from '@/components/form/Repeater';
import { ProjectCard } from './ProjectCard';
import { EMPTY_PROJECT, type BusinessContextData, type Project } from '@/types/business-context';

interface ProjectsStepProps {
  data: BusinessContextData;
  onChange: (data: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export function ProjectsStep({ data, onChange, errors }: ProjectsStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('wizard.projects.intro')}</p>

      <Repeater<Project>
        items={data.projects}
        onChange={(projects) => onChange({ projects })}
        newItem={() => ({ id: nanoid(), ...EMPTY_PROJECT })}
        itemLabel={(index) => t('wizard.projects.projectN', { n: index + 1 })}
        addLabel={t('wizard.projects.addProject')}
        removeLabel={t('wizard.projects.remove')}
        emptyLabel={t('wizard.projects.empty')}
        renderItem={(project, update, index) => (
          <ProjectCard project={project} update={update} index={index} errors={errors?.projects?.[index]} />
        )}
      />
    </div>
  );
}
