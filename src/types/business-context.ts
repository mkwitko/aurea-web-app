/**
 * Business Context Types - Frontend
 *
 * These mirror the backend types but are frontend-specific.
 */

// ─────────────────────────── Company Profile ───────────────────────────

export interface CompanyProfile {
  logoUrl?: string;
  foundedYear?: number;
  mission?: string;
  vision?: string;
  values?: string[];
  brandVoice?: string;
  fundingStage?: 'bootstrapped' | 'pre-seed' | 'seed' | 'series-a' | 'series-b' | 'series-c+' | 'public';
  headquarters?: string;
  employeeCount?: number;
  documentUrls?: string[];
}

// ─────────────────────────── Products & Services ───────────────────────────

export interface Product {
  id: string;
  name: string;
  description: string;
  targetAudience?: string;
  differentiator?: string;
  pricingModel?: 'free' | 'freemium' | 'subscription' | 'one-time' | 'usage-based' | 'custom';
  pricePoint?: string;
  status?: 'active' | 'beta' | 'planned' | 'sunset';
}

// ─────────────────────────── Competitive Landscape ───────────────────────────

export interface Competitor {
  name: string;
  url?: string;
  strengths: string[];
  weaknesses: string[];
  pricing?: string;
  positioning?: string;
  marketShare?: 'dominant' | 'major' | 'emerging' | 'niche';
}

export interface CompetitiveLandscape {
  competitors: Competitor[];
  ourDifferentiator?: string;
  marketPosition?: 'leader' | 'challenger' | 'follower' | 'niche';
  competitiveAdvantages: string[];
  threatsFromCompetitors: string[];
}

// ─────────────────────────── Market Context ───────────────────────────

export interface MarketContext {
  tam?: number;
  sam?: number;
  som?: number;
  marketGrowthRate?: number;
  trends: string[];
  opportunities: string[];
  threats: string[];
  maturity?: 'emerging' | 'growth' | 'mature' | 'declining';
}

// ─────────────────────────── Business Constraints ───────────────────────────

export interface BusinessConstraints {
  monthlyGrowthBudget?: number;
  teamSize?: number;
  growthTeamSize?: number;
  technicalCapabilities: string[];
  limitations: string[];
  regulatoryConstraints?: string[];
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}

// ─────────────────────────── Current Performance ───────────────────────────

export interface ChannelPerformance {
  channel: string;
  monthlyVisitors?: number;
  conversionRate?: number;
  cac?: number;
  contribution?: number;
}

export interface CurrentPerformance {
  mrr?: number;
  arr?: number;
  totalCustomers?: number;
  activeCustomers?: number;
  churnRate?: number;
  monthlySignups?: number;
  cac?: number;
  ltv?: number;
  ltvCacRatio?: number;
  conversionRate?: number;
  timeToConvert?: number;
  channels: ChannelPerformance[];
  baselineDate?: string;
}

// ─────────────────────────── Current Activities ───────────────────────────

export interface ContentProduction {
  blogPostsPerMonth?: number;
  socialPostsPerWeek?: number;
  emailCampaignsPerMonth?: number;
}

export interface PaidAdvertising {
  platforms?: string[];
  monthlySpend?: number;
}

export interface CurrentActivities {
  activeChannels: string[];
  contentProduction?: ContentProduction;
  paidAdvertising?: PaidAdvertising;
  partnerships?: string[];
  other?: string[];
}

// ─────────────────────────── Project Objectives ───────────────────────────

export interface ProjectObjective {
  id: string;
  description: string;
  metric?: string;
  baseline?: number;
  target?: number;
  unit?: string;
  deadline?: string;
  status?: 'not-started' | 'in-progress' | 'achieved' | 'missed';
}

// ─────────────────────────── Projects ───────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  type?: 'product' | 'marketing' | 'sales' | 'operations' | 'technical' | 'other';
  status?: 'planned' | 'in-progress' | 'completed' | 'on-hold';
  startDate?: string;
  endDate?: string;
  budget?: number;
  owner?: string;
  objectives: ProjectObjective[];
}

// ─────────────────────────── Campaign KPIs ───────────────────────────

export interface CampaignKpi {
  name: string;
  target: number;
  current?: number;
  unit?: string;
}

// ─────────────────────────── Campaigns ───────────────────────────

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  channel?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  status?: 'planned' | 'running' | 'finished' | 'paused';
  projectId?: string;
  targetAudience?: string;
  kpis: CampaignKpi[];
}

// ─────────────────────────── Complete Business Context ───────────────────────────

export interface BusinessContextData {
  companyProfile?: CompanyProfile;
  products: Product[];
  competitiveLandscape?: CompetitiveLandscape;
  marketContext?: MarketContext;
  constraints?: BusinessConstraints;
  currentPerformance?: CurrentPerformance;
  currentActivities?: CurrentActivities;
  projects?: Project[];
  campaigns?: Campaign[];
  completeness?: number;
  lastReviewedAt?: string;
  notes?: string;
}

// ─────────────────────────── Context Version ───────────────────────────

export interface BusinessContextVersion {
  id: string;
  version: number;
  data: BusinessContextData;
  source: 'USER' | 'RESEARCH' | 'INTEGRATION' | 'AI' | 'SYSTEM';
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERIFIED';
  createdAt: string;
  completeness?: number;
  incompleteSections?: ContextSection[];
  /**
   * Proveniência por seção — quem escreveu por último (AI grava rascunhos).
   * Chaveado pelo CAMPO de dados (companyProfile, products, …), como o
   * backend grava em update-section/applyOutput — não pela key curta da
   * seção ('company').
   */
  sectionMeta?: Partial<Record<keyof BusinessContextData, SectionMetaEntry>>;
}

export interface SectionMetaEntry {
  source: 'USER' | 'RESEARCH' | 'INTEGRATION' | 'AI' | 'SYSTEM';
  sourceAgentRunId?: string | null;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERIFIED';
}

// ─────────────────────────── Helper Types ───────────────────────────

export type ContextSection =
  | 'company'
  | 'products'
  | 'competitive'
  | 'market'
  | 'constraints'
  | 'performance'
  | 'activities'
  | 'projects'
  | 'campaigns';

// ─────────────────────────── Empty Defaults ───────────────────────────

export const EMPTY_PRODUCT: Omit<Product, 'id'> = {
  name: '',
  description: '',
  targetAudience: '',
  differentiator: '',
  pricingModel: undefined,
  pricePoint: '',
  status: 'active',
};

export const EMPTY_COMPETITOR: Competitor = {
  name: '',
  url: '',
  strengths: [],
  weaknesses: [],
  pricing: '',
  positioning: '',
  marketShare: undefined,
};

export const EMPTY_PROJECT_OBJECTIVE: Omit<ProjectObjective, 'id'> = {
  description: '',
  metric: '',
  baseline: undefined,
  target: undefined,
  unit: '',
  deadline: '',
  status: 'not-started',
};

export const EMPTY_PROJECT: Omit<Project, 'id'> = {
  name: '',
  description: '',
  type: undefined,
  status: 'planned',
  startDate: '',
  endDate: '',
  budget: undefined,
  owner: '',
  objectives: [],
};

export const EMPTY_CAMPAIGN_KPI: CampaignKpi = {
  name: '',
  target: 0,
  current: undefined,
  unit: '',
};

export const EMPTY_CAMPAIGN: Omit<Campaign, 'id'> = {
  name: '',
  description: '',
  channel: '',
  budget: undefined,
  startDate: '',
  endDate: '',
  status: 'planned',
  projectId: undefined,
  targetAudience: '',
  kpis: [],
};

export const EMPTY_CONTEXT_DATA: BusinessContextData = {
  companyProfile: {
    logoUrl: '',
    foundedYear: undefined,
    mission: '',
    vision: '',
    values: [],
    brandVoice: '',
    fundingStage: undefined,
    headquarters: '',
    employeeCount: undefined,
    documentUrls: [],
  },
  products: [],
  competitiveLandscape: {
    competitors: [],
    ourDifferentiator: '',
    marketPosition: undefined,
    competitiveAdvantages: [],
    threatsFromCompetitors: [],
  },
  marketContext: {
    tam: undefined,
    sam: undefined,
    som: undefined,
    marketGrowthRate: undefined,
    trends: [],
    opportunities: [],
    threats: [],
    maturity: undefined,
  },
  constraints: {
    monthlyGrowthBudget: undefined,
    teamSize: undefined,
    growthTeamSize: undefined,
    technicalCapabilities: [],
    limitations: [],
    regulatoryConstraints: [],
    urgency: undefined,
  },
  currentPerformance: {
    mrr: undefined,
    arr: undefined,
    totalCustomers: undefined,
    activeCustomers: undefined,
    churnRate: undefined,
    monthlySignups: undefined,
    cac: undefined,
    ltv: undefined,
    ltvCacRatio: undefined,
    conversionRate: undefined,
    timeToConvert: undefined,
    channels: [],
    baselineDate: undefined,
  },
  currentActivities: {
    activeChannels: [],
    contentProduction: undefined,
    paidAdvertising: undefined,
    partnerships: [],
    other: [],
  },
  projects: [],
  campaigns: [],
  notes: '',
};
