// The pack is far too big for localStorage once there is art in it, so the
// whole model lives in one IndexedDB record and is written back on a debounce.
const DB_NAME = 'assetpack-editor';
const DB_STORE = 'packs';
const DB_KEY = 'current';

function openDB() {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

async function dbPut(value) {
  const db = await openDB();
  return new Promise((ok, fail) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, DB_KEY);
    tx.oncomplete = () => { db.close(); ok(); };
    tx.onerror = () => { db.close(); fail(tx.error); };
  });
}

async function dbGet() {
  const db = await openDB();
  return new Promise((ok, fail) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(DB_KEY);
    req.onsuccess = () => { db.close(); ok(req.result || null); };
    req.onerror = () => { db.close(); fail(req.error); };
  });
}

async function dbClear() {
  const db = await openDB();
  return new Promise(ok => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(DB_KEY);
    tx.oncomplete = () => { db.close(); ok(); };
  });
}
