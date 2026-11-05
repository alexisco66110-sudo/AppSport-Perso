// Stockage local IndexedDB : pesées, séances, réglages.
const NAME = 'elan';
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('weights', { keyPath: 'id' }).createIndex('date', 'date');
      db.createObjectStore('workouts', { keyPath: 'id' }).createIndex('date', 'date');
      db.createObjectStore('settings', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const done = (tx) => new Promise((res, rej) => {
  tx.oncomplete = () => res();
  tx.onerror = () => rej(tx.error);
  tx.onabort = () => rej(tx.error);
});

export async function getAll(store) {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function put(store, ...records) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  records.forEach((r) => os.put(r));
  return done(tx);
}

export async function remove(store, ...ids) {
  const db = await open();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  ids.forEach((id) => os.delete(id));
  return done(tx);
}

export async function clear(...stores) {
  const db = await open();
  const tx = db.transaction(stores, 'readwrite');
  stores.forEach((s) => tx.objectStore(s).clear());
  return done(tx);
}

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
