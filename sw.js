const CACHE_VERSION = 'v6';
const CACHES = {
    static: `static-${CACHE_VERSION}`,
    dynamic: `dynamic-${CACHE_VERSION}`,
    images: `images-${CACHE_VERSION}`,
    api: `api-${CACHE_VERSION}`
};

const STATIC_ASSETS = [
    '/'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHES.static)
            .then(cache => {
                return cache.addAll(STATIC_ASSETS).catch(err => {
                    console.log('Cache addAll failed:', err);
                });
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => !Object.values(CACHES).includes(key))
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    
    const url = new URL(event.request.url);
    
    // Skip external resources except fonts
    if (url.origin !== location.origin && !url.hostname.includes('cdn.jsdelivr.net')) {
        return;
    }
    
    // Skip PHP files
    if (url.pathname.endsWith('.php')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // Static assets - Cache First
    if (url.pathname.match(/\.(js|css|woff2?|ttf)$/)) {
        event.respondWith(cacheFirst(event.request, CACHES.static));
        return;
    }
    
    // Images - Cache First
    if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico)$/)) {
        event.respondWith(cacheFirst(event.request, CACHES.images));
        return;
    }
    
    // API - Network First
    if (url.href.includes('/api/')) {
        event.respondWith(networkFirst(event.request, CACHES.api, 3000));
        return;
    }
    
    // Default - Network First
    event.respondWith(
        fetch(event.request)
            .catch(() => caches.match(event.request))
            .catch(() => caches.match('/index.html'))
    );
});

async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;
    
    try {
        const response = await fetch(request);
        if (response.ok && response.headers.get('content-type')?.includes('text/html') === false) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        return cached || new Response('Offline', { status: 503 });
    }
}

async function networkFirst(request, cacheName, timeout = 3000) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(request, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503 });
    }
}

self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncOfflineData());
    }
});

async function syncOfflineData() {
    try {
        const db = await openDB();
        const queue = await getAllFromStore(db, 'sync_queue');
        
        for (const item of queue) {
            try {
                const response = await fetch(item.url, {
                    method: item.method,
                    headers: item.headers,
                    body: item.body
                });
                
                if (response.ok) {
                    await deleteFromStore(db, 'sync_queue', item.id);
                } else {
                    item.retries = (item.retries || 0) + 1;
                    if (item.retries < 5) {
                        item.nextRetry = Date.now() + Math.pow(2, item.retries) * 1000;
                        await putInStore(db, 'sync_queue', item);
                    } else {
                        await deleteFromStore(db, 'sync_queue', item.id);
                    }
                }
            } catch (error) {
                console.error('Sync failed:', error);
            }
        }
    } catch (error) {
        console.error('Background sync error:', error);
    }
}

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ashke_ghalam_db', 2);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAllFromStore(db, storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteFromStore(db, storeName, id) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function putInStore(db, storeName, data) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

self.addEventListener('message', (event) => {
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
        );
    }
});
