// Web Worker برای عملیات سنگین IndexedDB
let db: IDBDatabase | null = null;
const DB_NAME = 'ashke_ghalam_db';
const DB_VERSION = 4;

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event: any) => {
      const database = event.target.result;
      
      const stores = [
        'products', 'people', 'invoices', 'vouchers', 'checks',
        'transactions', 'companies', 'sync_queue', 'error_logs',
        'blobs', 'backups', 'audit_logs', 'ml_cache'
      ];
      
      stores.forEach(store => {
        if (!database.objectStoreNames.contains(store)) {
          const objectStore = database.createObjectStore(store, { keyPath: 'id' });
          
          // ایجاد ایندکس برای جستجوی سریعتر
          if (store === 'audit_logs') {
            objectStore.createIndex('userId', 'userId', { unique: false });
            objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
          if (store === 'transactions') {
            objectStore.createIndex('personId', 'personId', { unique: false });
            objectStore.createIndex('date', 'date', { unique: false });
          }
        }
      });
    };
  });
};

self.onmessage = async (e: MessageEvent) => {
  const { action, storeName, data, id, page, pageSize } = e.data;
  
  try {
    if (!db) await initDB();
    
    switch (action) {
      case 'save':
        await save(storeName, data);
        self.postMessage({ success: true });
        break;
        
      case 'get':
        const item = await get(storeName, id);
        self.postMessage({ success: true, data: item });
        break;
        
      case 'getAll':
        const items = await getAll(storeName);
        self.postMessage({ success: true, data: items });
        break;
        
      case 'getPaginated':
        const paginated = await getPaginated(storeName, page, pageSize);
        self.postMessage({ success: true, data: paginated });
        break;
        
      case 'delete':
        await deleteItem(storeName, id);
        self.postMessage({ success: true });
        break;
        
      case 'compress':
        const compressed = await compressData(data);
        self.postMessage({ success: true, data: compressed });
        break;
        
      default:
        self.postMessage({ success: false, error: 'Unknown action' });
    }
  } catch (error: any) {
    self.postMessage({ success: false, error: error.message });
  }
};

const save = (storeName: string, data: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(data);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const get = (storeName: string, id: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getAll = (storeName: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getPaginated = (storeName: string, page: number, pageSize: number): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.openCursor();
    
    const results: any[] = [];
    let skipped = 0;
    const skipCount = (page - 1) * pageSize;
    
    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      
      if (cursor) {
        if (skipped < skipCount) {
          skipped++;
          cursor.continue();
        } else if (results.length < pageSize) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      } else {
        resolve(results);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
};

const deleteItem = (storeName: string, id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db!.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const compressData = async (data: any): Promise<string> => {
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  const uint8Array = encoder.encode(json);
  
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(uint8Array);
      controller.close();
    }
  });
  
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
  const chunks: Uint8Array[] = [];
  const reader = compressedStream.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return btoa(String.fromCharCode(...result));
};
