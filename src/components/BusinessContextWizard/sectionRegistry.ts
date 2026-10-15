/**
 * Section registry for the business-context wizard.
 *
 * Colocated with the step components it wires up rather than living in
 * `src/types/business-context.ts`: a types module that imports the React
 * component tree inverts the dependency direction domain types should have,
 * and it matters concretely once non-browser consumers (e.g. a worker) need
 * the plain data types without dragging React in.
 */

import type { ComponentType } from 'react';
import type { FieldErrors } from 'react-hook-form';
import type { BusinessContextData, ContextSection } from '@/types/business-context';
import { CompanyStep } from './steps/CompanyStep';
import { ProductsStep } from './steps/ProductsStep';
import { CompetitiveStep } from './steps/CompetitiveStep';
import { MarketStep } from './steps/MarketStep';
import { ConstraintsStep } from './steps/ConstraintsStep';
import { PerformanceStep } from './steps/PerformanceStep';
import { ActivitiesStep } from './steps/ActivitiesStep';
import { ProjectsStep } from './steps/ProjectsStep';
import { CampaignsStep } from './steps/CampaignsStep';

export interface StepProps {
  data: BusinessContextData;
  onChange: (patch: Partial<BusinessContextData>) => void;
  errors?: FieldErrors<BusinessContextData>;
}

export interface ContextSectionInfo {
  key: ContextSection;
  icon: string;
  /**
   * Onde os dados desta seção moram dentro de `BusinessContextData`, e —
   * porque só as seções propostas têm um — se a IA propõe esta seção.
   * Espelha `SECTION_FIELD` de `back/src/ai/agents/fill/context-sections.ts`
   * (cópia deliberada, como `src/lib/fill-paths.ts`: os dois repositórios não
   * compartilham código, e o backend recusa a seção no schema do run de
   * qualquer forma).
   *
   * `projects` e `campaigns` ficam sem campo porque são registro interno
   * inteiro: nome, orçamento, dono e objetivos de um projeto não existem em
   * lugar nenhum fora da empresa, então não há o que pesquisar — nenhum dos
   * dois agentes de fill os propõe.
   */
  field?: keyof BusinessContextData;
  Component: ComponentType<StepProps>;
}

export const CONTEXT_SECTIONS: ContextSectionInfo[] = [
  { key: 'company', icon: '🏢', field: 'companyProfile', Component: CompanyStep },
  { key: 'products', icon: '📦', field: 'products', Component: ProductsStep },
  { key: 'competitive', icon: '⚔️', field: 'competitiveLandscape', Component: CompetitiveStep },
  { key: 'market', icon: '📈', field: 'marketContext', Component: MarketStep },
  { key: 'constraints', icon: '🔧', field: 'constraints', Component: ConstraintsStep },
  { key: 'performance', icon: '📊', field: 'currentPerformance', Component: PerformanceStep },
  { key: 'activities', icon: '🚀', field: 'currentActivities', Component: ActivitiesStep },
  { key: 'projects', icon: '🗂️', Component: ProjectsStep },
  { key: 'campaigns', icon: '📣', Component: CampaignsStep },
];

/** Se a IA propõe esta seção. Ter um campo de destino é o que define isso. */
export const isAiFilled = (section: ContextSectionInfo): boolean => section.field !== undefined;

/** Quantas seções o botão de preencher em bloco realmente cobre. */
export const AI_FILLED_SECTION_COUNT = CONTEXT_SECTIONS.filter(isAiFilled).length;

/**
 * O campo de cada seção, indexado pela chave. Mesma verdade de
 * `CONTEXT_SECTIONS`, na forma que as telas de seção precisam (elas recebem a
 * chave pela rota e não iteram a lista).
 */
export const SECTION_FIELD: Partial<Record<ContextSection, keyof BusinessContextData>> = Object.fromEntries(
  CONTEXT_SECTIONS.filter((section) => section.field !== undefined).map((section) => [section.key, section.field]),
);
