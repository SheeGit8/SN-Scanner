/*
 * Label photos live in IndexedDB, one JPEG Blob per scan id. localStorage only holds about
 * 5 MB, so the scan record just gets `hasPhoto: true` and the image never goes there.
 * With the Google Sheet connected, photos taken here wait here until uploaded (stock.js), and
 * photos taken on other devices are kept here once they've been downloaded (ItemDrawer).
 */
const DB_NAME = 'it-stock-photos'
const STORE = 'photos'

let dbPromise

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB is not available'))
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch((err) => {
    dbPromise = undefined // let the next call try again
    throw err
  })
  return dbPromise
}

/** Runs `fn(store)` in one transaction and resolves with the request's result once it commits. */
async function run(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req?.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'))
  })
}

let askedToPersist = false

/** `persist: false` for copies downloaded from the sheet, which don't need the browser to keep them. */
export async function savePhoto(id, blob, { persist = true } = {}) {
  await run('readwrite', (store) => store.put(blob, id))
  // Ask once to keep photos when the browser is short on space. Fine if it says no.
  if (persist && !askedToPersist) {
    askedToPersist = true
    navigator.storage?.persist?.().catch(() => {})
  }
}

/** The photo Blob for a scan, or undefined. */
export const getPhoto = (id) => run('readonly', (store) => store.get(id))

/** Deletes the photos of these scans. Ids without a photo are ignored. */
export const deletePhotos = (ids) =>
  run('readwrite', (store) => {
    for (const id of ids) store.delete(id)
  })
