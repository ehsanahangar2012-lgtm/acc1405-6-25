// Enhanced Offline Queue Manager
import { useEffect } from 'react';
import { useStore } from '../store';
import { idbService } from '../services/indexedDBService';

interface QueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  timestamp: number;
  retries: number;
  lastError?: string;
}

export const OfflineQueueManager = () => {
  const { isOnline, offlineQueue, setOfflineQueue } = useStore();

  useEffect(() => {
    if (!isOnline) return;

    const processQueue = async () => {
      const queue = await getQueue();
      if (queue.length === 0) return;

      const results = await Promise.allSettled(
        queue.map(item => processQueueItem(item))
      );

      const failed = results
        .map((result, index) => ({ result, item: queue[index] }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ item }) => ({
          id: item.id,
          type: item.type.toUpperCase() as 'CREATE' | 'UPDATE' | 'DELETE',
          table: item.entity,
          data: item.data,
          timestamp: new Date(item.timestamp).toISOString(),
          retryCount: item.retries + 1
        }));

      if (failed.length > 0) {
        await saveQueue(results
          .map((result, index) => ({ result, item: queue[index] }))
          .filter(({ result }) => result.status === 'rejected')
          .map(({ item }) => ({
            ...item,
            retries: item.retries + 1,
            lastError: 'Sync failed'
          })));
      } else {
        await clearQueue();
      }

      setOfflineQueue(failed);
    };

    processQueue();
  }, [isOnline]);

  return null;
};

async function getQueue(): Promise<QueueItem[]> {
  return (await idbService.get('offline_queue')) || [];
}

async function saveQueue(queue: QueueItem[]) {
  await idbService.set('offline_queue', queue);
}

async function clearQueue() {
  await idbService.remove('offline_queue');
}

async function processQueueItem(item: QueueItem) {
  if (item.retries >= 3) {
    throw new Error('Max retries exceeded');
  }

  // پردازش بر اساس نوع عملیات
  const response = await fetch(`/api/${item.entity}`, {
    method: item.type === 'create' ? 'POST' : item.type === 'update' ? 'PUT' : 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item.data)
  });

  if (!response.ok) throw new Error('Request failed');
  return response.json();
}

export const addToOfflineQueue = async (item: Omit<QueueItem, 'id' | 'timestamp' | 'retries'>) => {
  const queue = await getQueue();
  queue.push({
    ...item,
    id: Date.now().toString(),
    timestamp: Date.now(),
    retries: 0
  });
  await saveQueue(queue);
};
