import type { OwnerBillingLoadResult } from './owner-billing.ts';

export type CrmRange = '30d' | '90d' | '12m';
export type CrmSection = 'overview' | 'customers' | 'pipeline' | 'support' | 'revenue' | 'costs' | 'reports' | 'sources' | 'health';
export const CRM_STAGES = ['lead', 'contacted', 'qualified', 'customer', 'archived'] as const;
export const CRM_SOURCES = ['unknown', 'direct', 'referral', 'organic', 'social', 'paid', 'other'] as const;
export type CrmStage = typeof CRM_STAGES[number];
export type CrmSource = typeof CRM_SOURCES[number];

export interface CrmContact {
  id: string;
  accountId: string | null;
  name: string;
  email: string;
  company: string;
  stage: CrmStage;
  source: CrmSource;
  notes: string;
  followUpOn: string | null;
  isTest: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
}
export type CrmContactInput = Omit<CrmContact, 'id' | 'createdAt' | 'updatedAt' | 'revision'> & {
  id?: string;
  expectedRevision?: number;
};
export interface CrmContactStore {
  list(): Promise<CrmContact[]>;
  put(input: CrmContactInput): Promise<CrmContact>;
}
export interface CrmAccount {
  id: string;
  authUserId: string | null;
  name: string;
  email: string;
  plan: string;
  createdAt: string;
  ownedSites: number;
  publishedSites: number;
  mediaBytes: number;
  lastEditedAt: string | null;
}
export interface CrmSite {
  id: string;
  ownerIds: string[];
  name: string;
  slug: string;
  published: boolean;
  createdAt: string | null;
  updatedAt: string;
}
export interface CrmPlatformSnapshot {
  accounts: CrmAccount[];
  sites: CrmSite[];
  accountTotal: number;
  siteTotal: number;
  coverage: 'complete' | 'partial';
}
export interface CrmPlatformSource { snapshot(): Promise<CrmPlatformSnapshot> }
export interface CrmCustomer {
  id: string;
  accountId: string | null;
  contactId: string | null;
  name: string;
  email: string;
  company: string;
  plan: string | null;
  ownedSites: number | null;
  publishedSites: number | null;
  mediaBytes: number | null;
  joinedAt: string;
  lastEditedAt: string | null;
  stage: CrmStage;
  source: CrmSource;
  notes: string;
  followUpOn: string | null;
  isTest: boolean;
  revision: number | null;
}
export interface CrmSeriesPoint { date: string; value: number }
export interface CrmMoneySeries { currencyCode: string; points: { date: string; amountMinor: string }[] }
export interface FounderCrmData {
  generatedAt: string;
  range: CrmRange;
  periodStart: string;
  periodEnd: string;
  includeTests: boolean;
  platform: { state: 'available' | 'unavailable' | 'not_connected'; snapshot: CrmPlatformSnapshot | null };
  crm: { state: 'available' | 'unavailable' | 'not_connected'; contacts: CrmContact[] };
  customers: CrmCustomer[];
  analytics: {
    accountGrowth: CrmSeriesPoint[];
    siteGrowth: CrmSeriesPoint[];
    newAccounts: number | null;
    activation: { eligibleAccounts: number; publishedAccounts: number; rate: number | null } | null;
    planMix: { label: string; value: number }[];
    pipeline: { stage: CrmStage; value: number }[];
    sources: { source: CrmSource; value: number }[];
    followUps: CrmCustomer[];
    chargeHistory: CrmMoneySeries[];
  };
  billing: Extract<OwnerBillingLoadResult, { status: 'ok' }>;
}
export interface FounderCrmQuery { range?: CrmRange; includeTests?: boolean }
export interface CrmSupportTicket {
  id: string;
  subject: string;
  updatedAt: string;
  accountEmail?: string | null;
  latestMessageRole?: 'customer' | 'support' | null;
}
export interface CrmSupportInbox {
  environment: 'production' | 'staging';
  sourceLabel: string;
  state: 'available' | 'unavailable' | 'not_connected';
  tickets: CrmSupportTicket[];
  selected: (CrmSupportTicket & {
    messages: { role: 'customer' | 'support'; body: string; createdAt: string }[];
  }) | null;
  requestId: string;
  draftBody?: string;
}
export interface FounderCrmPageInput {
  section: CrmSection;
  support?: CrmSupportInbox;
  dataEnvironment: 'staging' | 'production' | 'unconfigured';
  currencyCode?: string;
  error?: string;
  message?: string;
  editContactId?: string;
  editAccountId?: string;
  draftContact?: Partial<CrmContactInput>;
  costInput?: import('./owner-billing-routes.ts').OwnerBillingPageInput;
  csrfOrigin?: string;
  /** Only used by isolated local fixtures; never configured by the hosted runtime. */
  previewLabel?: string;
  /** The System health section; null means it is not configured for this runtime. */
  systemHealth?: import('./system-health.ts').SystemHealthSnapshot | null;
  /** Plan level of the open account. Undefined: plan changes are not configured. Null: unavailable. */
  planStatus?: import('./plan-grants.ts').AccountPlanStatus | null;
}

/** What the founder console needs to give or remove a plan. */
export interface CrmPlanManager {
  status(userId: string): Promise<import('./plan-grants.ts').AccountPlanStatus>;
  grant(input: import('./plan-grants.ts').PlanGrantInput): Promise<unknown>;
  revoke(grantId: string, revokedBy: string): Promise<unknown>;
}
