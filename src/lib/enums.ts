import type {
  BusinessConstraints,
  Campaign,
  CompanyProfile,
  Competitor,
  CompetitiveLandscape,
  MarketContext,
  Product,
  Project,
  ProjectObjective,
} from '@/types/business-context';

export interface EnumOption<T extends string> {
  value: T;
  /** Chave de i18n. Quem renderiza traduz — este módulo não importa i18next. */
  labelKey: string;
}

export const FUNDING_STAGE_OPTIONS: EnumOption<NonNullable<CompanyProfile['fundingStage']>>[] = [
  { value: 'bootstrapped', labelKey: 'enums.fundingStage.bootstrapped' },
  { value: 'pre-seed', labelKey: 'enums.fundingStage.preSeed' },
  { value: 'seed', labelKey: 'enums.fundingStage.seed' },
  { value: 'series-a', labelKey: 'enums.fundingStage.seriesA' },
  { value: 'series-b', labelKey: 'enums.fundingStage.seriesB' },
  { value: 'series-c+', labelKey: 'enums.fundingStage.seriesCPlus' },
  { value: 'public', labelKey: 'enums.fundingStage.public' },
];

export const PRICING_MODEL_OPTIONS: EnumOption<NonNullable<Product['pricingModel']>>[] = [
  { value: 'free', labelKey: 'enums.pricingModel.free' },
  { value: 'freemium', labelKey: 'enums.pricingModel.freemium' },
  { value: 'subscription', labelKey: 'enums.pricingModel.subscription' },
  { value: 'one-time', labelKey: 'enums.pricingModel.oneTime' },
  { value: 'usage-based', labelKey: 'enums.pricingModel.usageBased' },
  { value: 'custom', labelKey: 'enums.pricingModel.custom' },
];

export const PRODUCT_STATUS_OPTIONS: EnumOption<NonNullable<Product['status']>>[] = [
  { value: 'active', labelKey: 'enums.productStatus.active' },
  { value: 'beta', labelKey: 'enums.productStatus.beta' },
  { value: 'planned', labelKey: 'enums.productStatus.planned' },
  { value: 'sunset', labelKey: 'enums.productStatus.sunset' },
];

export const MARKET_SHARE_OPTIONS: EnumOption<NonNullable<Competitor['marketShare']>>[] = [
  { value: 'dominant', labelKey: 'enums.marketShare.dominant' },
  { value: 'major', labelKey: 'enums.marketShare.major' },
  { value: 'emerging', labelKey: 'enums.marketShare.emerging' },
  { value: 'niche', labelKey: 'enums.marketShare.niche' },
];

export const MARKET_POSITION_OPTIONS: EnumOption<
  NonNullable<CompetitiveLandscape['marketPosition']>
>[] = [
  { value: 'leader', labelKey: 'enums.marketPosition.leader' },
  { value: 'challenger', labelKey: 'enums.marketPosition.challenger' },
  { value: 'follower', labelKey: 'enums.marketPosition.follower' },
  { value: 'niche', labelKey: 'enums.marketPosition.niche' },
];

export const MATURITY_OPTIONS: EnumOption<NonNullable<MarketContext['maturity']>>[] = [
  { value: 'emerging', labelKey: 'enums.maturity.emerging' },
  { value: 'growth', labelKey: 'enums.maturity.growth' },
  { value: 'mature', labelKey: 'enums.maturity.mature' },
  { value: 'declining', labelKey: 'enums.maturity.declining' },
];

export const URGENCY_OPTIONS: EnumOption<NonNullable<BusinessConstraints['urgency']>>[] = [
  { value: 'low', labelKey: 'enums.urgency.low' },
  { value: 'medium', labelKey: 'enums.urgency.medium' },
  { value: 'high', labelKey: 'enums.urgency.high' },
  { value: 'critical', labelKey: 'enums.urgency.critical' },
];

export const PROJECT_TYPE_OPTIONS: EnumOption<NonNullable<Project['type']>>[] = [
  { value: 'product', labelKey: 'enums.projectType.product' },
  { value: 'marketing', labelKey: 'enums.projectType.marketing' },
  { value: 'sales', labelKey: 'enums.projectType.sales' },
  { value: 'operations', labelKey: 'enums.projectType.operations' },
  { value: 'technical', labelKey: 'enums.projectType.technical' },
  { value: 'other', labelKey: 'enums.projectType.other' },
];

export const PROJECT_STATUS_OPTIONS: EnumOption<NonNullable<Project['status']>>[] = [
  { value: 'planned', labelKey: 'enums.projectStatus.planned' },
  { value: 'in-progress', labelKey: 'enums.projectStatus.inProgress' },
  { value: 'completed', labelKey: 'enums.projectStatus.completed' },
  { value: 'on-hold', labelKey: 'enums.projectStatus.onHold' },
];

export const OBJECTIVE_STATUS_OPTIONS: EnumOption<
  NonNullable<ProjectObjective['status']>
>[] = [
  { value: 'not-started', labelKey: 'enums.objectiveStatus.notStarted' },
  { value: 'in-progress', labelKey: 'enums.objectiveStatus.inProgress' },
  { value: 'achieved', labelKey: 'enums.objectiveStatus.achieved' },
  { value: 'missed', labelKey: 'enums.objectiveStatus.missed' },
];

export const CAMPAIGN_STATUS_OPTIONS: EnumOption<NonNullable<Campaign['status']>>[] = [
  { value: 'planned', labelKey: 'enums.campaignStatus.planned' },
  { value: 'running', labelKey: 'enums.campaignStatus.running' },
  { value: 'finished', labelKey: 'enums.campaignStatus.finished' },
  { value: 'paused', labelKey: 'enums.campaignStatus.paused' },
];
