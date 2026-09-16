// Migration Utility - انتقال دادههای قدیمی به سیستم جدید
import { syncMetadata } from './syncMetadataService';
import { useStore } from '../store';

interface MigrationResult {
  migrated: number;
  errors: number;
}

export const migrationService = {
  // مهاجرت تمام دادههای موجود
  async migrateAllData(): Promise<MigrationResult> {
    const store = useStore.getState();
    let migrated = 0;
    let errors = 0;

    const collections = [
      { name: 'products', data: store.products },
      { name: 'people', data: store.people },
      { name: 'invoices', data: store.invoices },
      { name: 'vouchers', data: store.vouchers },
      { name: 'checks', data: store.checks },
      { name: 'transactions', data: store.transactions },
    ];

    for (const collection of collections) {
      try {
        for (const item of collection.data) {
          if (!item?.id) continue;
          
          // بررسی اینکه آیا قبلاً metadata دارد
          const existing = syncMetadata.getMetadata(item.id);
          if (!existing) {
            // اضافه کردن metadata
            syncMetadata.enrichRecord(item, true);
            migrated++;
          }
        }
      } catch (error) {
        console.error(`Migration error in ${collection.name}:`, error);
        errors++;
      }
    }

    console.log(`✅ Migration completed: ${migrated} records, ${errors} errors`);
    return { migrated, errors };
  },

  // بررسی نیاز به migration
  needsMigration(): boolean {
    try {
      const store = useStore.getState();
      const sampleItems = [
        ...store.products.slice(0, 5),
        ...store.people.slice(0, 5),
        ...store.invoices.slice(0, 5),
      ];

      // اگر هیچ کدام metadata ندارند، نیاز به migration است
      return sampleItems.length > 0 && sampleItems.every(item => item?.id && !syncMetadata.getMetadata(item.id));
    } catch {
      return false;
    }
  },

  // پاکسازی metadata های orphan (بدون رکورد)
  async cleanupOrphanMetadata(): Promise<number> {
    const store = useStore.getState();
    const allIds = new Set([
      ...store.products.map(p => p.id),
      ...store.people.map(p => p.id),
      ...store.invoices.map(i => i.id),
      ...store.vouchers.map(v => v.id),
      ...store.checks.map(c => c.id),
      ...store.transactions.map(t => t.id),
    ]);

    const metadataKey = 'sync_metadata_v1';
    const allMetadata = JSON.parse(localStorage.getItem(metadataKey) || '{}');
    let cleaned = 0;

    Object.keys(allMetadata).forEach(id => {
      if (!allIds.has(id)) {
        delete allMetadata[id];
        cleaned++;
      }
    });

    localStorage.setItem(metadataKey, JSON.stringify(allMetadata));
    console.log(`🧹 Cleaned ${cleaned} orphan metadata`);
    return cleaned;
  }
};
