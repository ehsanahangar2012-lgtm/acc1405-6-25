// Types for CMS, SEO, and Marketing Platform

export interface CMSField {
  name: string;
  key: string;
  type: 'text' | 'rich-text' | 'number' | 'image' | 'select' | 'boolean';
  required: boolean;
  options?: string[]; // for select dropdowns
}

export interface CMSSchema {
  id: string;
  name: string;
  description: string;
  fields: CMSField[];
  createdAt: string;
  updatedAt: string;
}

export interface CMSEntry {
  id: string;
  schemaId: string;
  slug: string;
  status: 'DRAFT' | 'PUBLISHED';
  fields: Record<string, any>; // maps keys from CMSSchema fields to values
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SeoKeywordHistory {
  date: string;
  position: number;
}

export interface SeoKeyword {
  id: string;
  keyword: string;
  volume: number; // monthly search volume
  difficulty: number; // 0-100 difficulty index
  currentPosition: number; // simulated rank
  previousPosition: number;
  history: SeoKeywordHistory[];
  competitors: { name: string; url: string; rank: number }[];
  updatedAt: string;
}

export interface SeoAuditResult {
  id: string;
  slug: string;
  score: number; // 0-100 score
  criteria: {
    titleLengthOk: boolean;
    metaDescriptionOk: boolean;
    h1Count: number; // must be exactly 1
    contentLength: number; // word count
    keywordDensity: number; // percentage
    persianHalfSpaceCheck: boolean; // checks for 'نیم‌فاصله' usage
    imageAltCheck: boolean;
  };
  suggestions: string[];
  jsonLdSchema: string; // generated Schema.org JSON-LD string
  updatedAt: string;
}

export interface PrintCalculatorConfig {
  paperType: 'Kraft' | 'Duplex' | 'Glossy' | 'Ivory Board' | 'Cardboard';
  paperWeight: number; // e.g. 80, 135, 250, 300
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  printMethod: 'Digital' | 'Offset Sheet' | 'Flexo';
  finishes: string[]; // e.g. Lamination, Spot UV, Hot Foil, Die Cut
  quantity: number;
  estimatedCost: number;
}

export interface B2BLead {
  id: string;
  name: string;
  company: string;
  phone: string;
  email?: string;
  calculatorConfig?: PrintCalculatorConfig;
  status: 'INQUIRY' | 'QUOTATION' | 'CONTRACT' | 'INVOICE' | 'LOST';
  notes: string;
  createdAt: string;
  updatedAt: string;
  dealValue: number;
}

export interface MarketingPublisherConfig {
  telegramBotToken: string;
  telegramChannelChatId: string;
  telegramEnabled: boolean;
  baleWebhookUrl: string;
  baleEnabled: boolean;
  publicWebRootUrl: string;
}
