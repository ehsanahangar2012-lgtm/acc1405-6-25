import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CMSSchema, CMSEntry, SeoKeyword, SeoAuditResult, B2BLead, MarketingPublisherConfig } from './types-marketing';
import { generateId, getPersianDate } from './utils';
import { hostDB } from './services/hostDatabaseService';

interface MarketingState {
  schemas: CMSSchema[];
  entries: CMSEntry[];
  seoKeywords: SeoKeyword[];
  seoAudits: SeoAuditResult[];
  leads: B2BLead[];
  publisherConfig: MarketingPublisherConfig;
  isLoading: boolean;

  // Schema Actions
  addSchema: (schema: CMSSchema) => void;
  updateSchema: (id: string, updates: Partial<CMSSchema>) => void;
  deleteSchema: (id: string) => void;

  // Entry Actions
  addEntry: (entry: CMSEntry) => void;
  updateEntry: (id: string, updates: Partial<CMSEntry>) => void;
  deleteEntry: (id: string) => void;

  // SEO Actions
  addSeoKeyword: (kw: SeoKeyword) => void;
  updateSeoKeyword: (id: string, updates: Partial<SeoKeyword>) => void;
  deleteSeoKeyword: (id: string) => void;
  addSeoAudit: (audit: SeoAuditResult) => void;
  deleteSeoAudit: (id: string) => void;

  // Lead Actions
  addLead: (lead: B2BLead) => void;
  updateLead: (id: string, updates: Partial<B2BLead>) => void;
  deleteLead: (id: string) => void;

  // Publisher Actions
  updatePublisherConfig: (config: Partial<MarketingPublisherConfig>) => void;

  // Host Syncing
  fetchFromHost: () => Promise<void>;
  syncToHost: () => Promise<void>;
}

const defaultPublisherConfig: MarketingPublisherConfig = {
  telegramBotToken: '',
  telegramChannelChatId: '',
  telegramEnabled: false,
  baleWebhookUrl: '',
  baleEnabled: false,
  publicWebRootUrl: 'https://ashkghalam.ir'
};

export const useMarketingStore = create<MarketingState>()(
  persist(
    (set, get) => {
      // Expose store for console debugging if needed
      if (typeof window !== 'undefined') {
        (window as any).__MARKETING_STORE__ = { getState: get, setState: set };
      }

      return {
        schemas: [],
        entries: [],
        seoKeywords: [],
        seoAudits: [],
        leads: [],
        publisherConfig: defaultPublisherConfig,
        isLoading: false,

        // Schema Actions
        addSchema: (schema) => set(state => {
          const updated = [...state.schemas, schema];
          hostDB.save('marketing_schemas', schema).catch(() => {});
          return { schemas: updated };
        }),
        updateSchema: (id, updates) => set(state => {
          const schema = state.schemas.find(s => s.id === id);
          if (!schema) return {};
          const updatedSchema = { ...schema, ...updates, updatedAt: getPersianDate() };
          hostDB.save('marketing_schemas', updatedSchema).catch(() => {});
          return {
            schemas: state.schemas.map(s => s.id === id ? updatedSchema : s)
          };
        }),
        deleteSchema: (id) => set(state => {
          hostDB.deleteFromHost('marketing_schemas', id).catch(() => {});
          return {
            schemas: state.schemas.filter(s => s.id !== id)
          };
        }),

        // Entry Actions
        addEntry: (entry) => set(state => {
          const updated = [...state.entries, entry];
          hostDB.save('marketing_entries', entry).catch(() => {});
          return { entries: updated };
        }),
        updateEntry: (id, updates) => set(state => {
          const entry = state.entries.find(e => e.id === id);
          if (!entry) return {};
          const updatedEntry = { ...entry, ...updates, updatedAt: getPersianDate() };
          hostDB.save('marketing_entries', updatedEntry).catch(() => {});
          return {
            entries: state.entries.map(e => e.id === id ? updatedEntry : e)
          };
        }),
        deleteEntry: (id) => set(state => {
          hostDB.deleteFromHost('marketing_entries', id).catch(() => {});
          return {
            entries: state.entries.filter(e => e.id !== id)
          };
        }),

        // SEO Actions
        addSeoKeyword: (kw) => set(state => {
          const updated = [...state.seoKeywords, kw];
          hostDB.save('marketing_keywords', kw).catch(() => {});
          return { seoKeywords: updated };
        }),
        updateSeoKeyword: (id, updates) => set(state => {
          const kw = state.seoKeywords.find(k => k.id === id);
          if (!kw) return {};
          const updatedKw = { ...kw, ...updates, updatedAt: getPersianDate() };
          hostDB.save('marketing_keywords', updatedKw).catch(() => {});
          return {
            seoKeywords: state.seoKeywords.map(k => k.id === id ? updatedKw : k)
          };
        }),
        deleteSeoKeyword: (id) => set(state => {
          hostDB.deleteFromHost('marketing_keywords', id).catch(() => {});
          return {
            seoKeywords: state.seoKeywords.filter(k => k.id !== id)
          };
        }),
        addSeoAudit: (audit) => set(state => {
          const updated = [...state.seoAudits, audit];
          hostDB.save('marketing_audits', audit).catch(() => {});
          return { seoAudits: updated };
        }),
        deleteSeoAudit: (id) => set(state => {
          hostDB.deleteFromHost('marketing_audits', id).catch(() => {});
          return {
            seoAudits: state.seoAudits.filter(a => a.id !== id)
          };
        }),

        // Lead Actions
        addLead: (lead) => set(state => {
          const updated = [...state.leads, lead];
          hostDB.save('marketing_leads', lead).catch(() => {});
          return { leads: updated };
        }),
        updateLead: (id, updates) => set(state => {
          const lead = state.leads.find(l => l.id === id);
          if (!lead) return {};
          const updatedLead = { ...lead, ...updates, updatedAt: getPersianDate() };
          hostDB.save('marketing_leads', updatedLead).catch(() => {});
          return {
            leads: state.leads.map(l => l.id === id ? updatedLead : l)
          };
        }),
        deleteLead: (id) => set(state => {
          hostDB.deleteFromHost('marketing_leads', id).catch(() => {});
          return {
            leads: state.leads.filter(l => l.id !== id)
          };
        }),

        // Publisher Actions
        updatePublisherConfig: (config) => set(state => {
          const updatedConfig = { ...state.publisherConfig, ...config };
          hostDB.save('marketing_config', { id: 'singleton_config', ...updatedConfig }).catch(() => {});
          return { publisherConfig: updatedConfig };
        }),

        // Host Syncing (Pull updates from Server)
        fetchFromHost: async () => {
          set({ isLoading: true });
          try {
            const schemas = await hostDB.syncFromHost('marketing_schemas');
            const entries = await hostDB.syncFromHost('marketing_entries');
            const seoKeywords = await hostDB.syncFromHost('marketing_keywords');
            const seoAudits = await hostDB.syncFromHost('marketing_audits');
            const leads = await hostDB.syncFromHost('marketing_leads');
            const configData = await hostDB.get('marketing_config', 'singleton_config');

            set({
              schemas: schemas || [],
              entries: entries || [],
              seoKeywords: seoKeywords || [],
              seoAudits: seoAudits || [],
              leads: leads || [],
              publisherConfig: configData ? { ...defaultPublisherConfig, ...configData } : defaultPublisherConfig,
              isLoading: false
            });
          } catch (e) {
            console.error('Marketing Hub fetch failed:', e);
            set({ isLoading: false });
          }
        },

        // Trigger pushing queued operations to Host
        syncToHost: async () => {
          try {
            await hostDB.processQueue();
          } catch (e) {
            console.error('Marketing queue push failed:', e);
          }
        }
      };
    },
    {
      name: 'ashke-ghalam-marketing-hub-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => Object.fromEntries(Object.entries(state).filter(([key]) => !['isLoading'].includes(key)))
    }
  )
);
