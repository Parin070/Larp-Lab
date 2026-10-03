// Native zero-dependency IndexedDB wrapper with in-memory fallback for Node/tests

const DB_NAME = 'living_city_db';
const STORE_NAME = 'saves';
const DB_VERSION = 1;

// In-memory fallback map when running outside browser environment
const memoryStore = new Map();

function getIDB() {
  if (typeof globalThis !== 'undefined' && globalThis.indexedDB) {
    return globalThis.indexedDB;
  }
  return null;
}

function openDB() {
  const idb = getIDB();
  if (!idb) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function setItem(key, value) {
  const db = await openDB();
  if (!db) {
    memoryStore.set(key, JSON.parse(JSON.stringify(value)));
    return true;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

export async function getItem(key) {
  const db = await openDB();
  if (!db) {
    const val = memoryStore.get(key);
    return val ? JSON.parse(JSON.stringify(val)) : null;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);

    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function removeItem(key) {
  const db = await openDB();
  if (!db) {
    memoryStore.delete(key);
    return true;
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);

    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}
