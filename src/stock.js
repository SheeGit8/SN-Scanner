/*
 * The stock list the screens use: add, update and remove scans, and see them change.
 *
 * Production (VITE_REMOTE_API set): the shared Google Sheet is the database. Changes show at once,
 * wait in an outbox while offline, and go to the sheet in order (rules in sync.js). Every open
 * page checks the sheet for other people's changes every 45 seconds and when it comes back into
 * view. Label photos go to the sheet's Drive folder after the item itself.
 *
 * Development (no VITE_REMOTE_API): the list lives in this browser only.
 */
import { useSyncExternalStore } from 'react'
import { call, hasPassword, isRemote, setPassword } from './lib/api.js'
import { deletePhotos, getPhoto } from './photos.js'
import { SCANS_KEY, itemName, makeId } from './storage.js'
import { applyOps, itemForSheet, queueOp, removeSent, sortNewestFirst, takeBatch } from './sync.js'

const SHEET_KEY = 'it-stock-sheet-v1' // the sheet's last copy: { items, version }
const OUTBOX_KEY = 'it-stock-outbox-v1' // changes the sheet doesn't have yet

export const POLL_MS = 45_000
const SEND_DELAY_MS = 300 // lets a quick run of edits go in one request
const MAX_RETRY_MS = 120_000

/** Fields people can change after a scan is saved. */
const EDIT_KEYS = ['serial', 'name', 'user', 'model', 'color', 'location', 'note']

function reader(storage) {
  return {
    read(key, fallback) {
      try {
        const raw = storage.getItem(key)
        return raw ? JSON.parse(raw) : fallback
      } catch {
        return fallback
      }
    },
    write(key, value) {
      try {
        storage.setItem(key, JSON.stringify(value))
      } catch {
        /* full or blocked: the list still works until the page closes */
      }
    },
    remove(key) {
      try {
        storage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
  }
}

function listeners() {
  const set = new Set()
  return {
    subscribe(fn) {
      set.add(fn)
      return () => set.delete(fn)
    },
    emit: () => set.forEach((fn) => fn()),
  }
}

/** The change a queued op sends: only what the sheet stores. */
function toServer(o) {
  if (o.op === 'add') return { op: 'add', id: o.id, item: itemForSheet(o.item) }
  if (o.op === 'update') return { op: 'update', id: o.id, patch: o.patch }
  return { op: o.op, id: o.id }
}

/** The sheet looked at the request and said no (a bad photo, say). Trying again won't help. */
const isRefusal = (err) => !err.auth && !err.offline && err.status === 400

/**
 * Snapshot states: 'ok' (last request worked), 'busy' (a request is running), 'offline',
 * 'error' (`error` says why) and 'locked' (the app password is missing or wrong).
 */
export function createStockSync({
  call: api,
  storage = globalThis.localStorage,
  readPhoto, // async (id) => data URL of the label photo on this device, or null
  forgetPhotos = async () => {}, // async (ids) => removes photos kept on this device
  needsPassword = () => false,
  savePassword = () => {},
  isOnline = () => globalThis.navigator?.onLine !== false,
  lock = (fn) => fn(), // runs `fn` while no other tab is sending
  newKey = makeId,
  setTimer = globalThis.setTimeout?.bind(globalThis),
  clearTimer = globalThis.clearTimeout?.bind(globalThis),
}) {
  const store = reader(storage)
  const subs = listeners()

  let sheet = store.read(SHEET_KEY, null)
  let outbox = store.read(OUTBOX_KEY, [])
  let sheetGen = 0 // bumps whenever `sheet` is replaced, so a slower, older read can't overwrite it
  let locked = needsPassword()
  let state = locked ? 'locked' : 'ok'
  let error = locked ? 'Enter the app password.' : ''
  let lockId = locked ? 1 : 0 // bumps each time the app locks, so screens can ask once per lock
  // Notices raised before the screens are listening (the move of old scans at start) wait here.
  const early = []
  let notify = (...args) => early.push(args)

  let shown = { sheet: undefined, outbox: undefined, scans: [] }
  const scansNow = () => {
    if (shown.sheet !== sheet || shown.outbox !== outbox) {
      shown = { sheet, outbox, scans: sortNewestFirst(applyOps(sheet?.items ?? [], outbox)) }
    }
    return shown.scans
  }
  let snap
  const emit = () => {
    snap = { mode: 'remote', scans: scansNow(), loaded: !!sheet, state, error, pending: outbox.length, lockId }
    subs.emit()
  }
  emit()

  const setState = (next, message = '') => {
    if (next === state && message === error) return
    state = next
    error = message
    emit()
  }

  /* ---------- Changes ---------- */

  let timer = null
  const schedule = (ms) => {
    if (timer) clearTimer(timer)
    timer = setTimer(() => pump(), ms)
  }

  function queue(ops) {
    if (!ops.length) return
    let next = store.read(OUTBOX_KEY, outbox) // another tab may have queued changes too
    for (const op of ops) next = queueOp(next, { ...op, key: newKey() })
    outbox = next
    store.write(OUTBOX_KEY, outbox)
    emit()
    schedule(SEND_DELAY_MS)
  }

  function add(scan) {
    const ops = [{ op: 'add', id: scan.id, item: itemForSheet(scan) }]
    if (scan.hasPhoto) ops.push({ op: 'photo', id: scan.id })
    queue(ops)
  }

  /** Sends only the fields that really changed, so it can't undo someone else's edit to another field. */
  function update(id, patch) {
    const current = scansNow().find((s) => s.id === id)
    if (!current) return
    const changed = {}
    for (const key of EDIT_KEYS) {
      if (!(key in patch)) continue
      const before = key === 'name' ? itemName(current) : (current[key] ?? '')
      const after = String(patch[key] ?? '')
      if (after !== String(before)) changed[key] = after
    }
    if (Object.keys(changed).length) queue([{ op: 'update', id, patch: changed }])
  }

  function remove(ids) {
    queue(ids.map((id) => ({ op: 'delete', id })))
    // A photo kept on this device is only a copy (or an upload that is no longer needed).
    forgetPhotos(ids).catch(() => {})
  }

  /** Scans saved in this browser before the sheet was connected go to the sheet once. */
  function migrate() {
    const legacy = store.read(SCANS_KEY, null)
    if (!legacy) return 0
    const scans = Array.isArray(legacy) ? legacy.filter((s) => s?.id) : []
    if (scans.length) {
      // Oldest first, so they land in the sheet in the order they were scanned. Photos after the rows.
      const ordered = [...scans].reverse()
      queue([
        ...ordered.map((s) => ({ op: 'add', id: s.id, item: itemForSheet(s) })),
        ...ordered.filter((s) => s.hasPhoto).map((s) => ({ op: 'photo', id: s.id })),
      ])
      const count = scans.length === 1 ? '1 scan' : `${scans.length} scans`
      notify(`${count} saved on this device before the Google Sheet was connected will be added to it.`, 'info')
    }
    // Only now: the outbox already holds them, so closing the page here loses nothing.
    store.remove(SCANS_KEY)
    return scans.length
  }

  /* ---------- Talking to the sheet ---------- */

  function setSheet(next) {
    const before = sheet?.items ?? []
    sheet = { items: next.items, version: next.version }
    sheetGen++
    store.write(SHEET_KEY, sheet)
    // Items someone deleted: drop the copies of their photos kept on this device.
    const still = new Set([...sheet.items.map((s) => s.id), ...outbox.map((o) => o.id)])
    const gone = before.filter((s) => s.hasPhoto && !still.has(s.id)).map((s) => s.id)
    if (gone.length) forgetPhotos(gone).catch(() => {})
  }

  /** Sends the outbox in order. Returns how many requests went out. */
  async function sendOutbox() {
    let sent = 0
    for (;;) {
      const batch = takeBatch(store.read(OUTBOX_KEY, outbox))
      if (!batch) return sent
      sent++
      if (batch.kind === 'changes') {
        const res = await api('applyChanges', batch.ops.map(toServer))
        outbox = removeSent(store.read(OUTBOX_KEY, outbox), batch.ops)
        store.write(OUTBOX_KEY, outbox)
        setSheet(res)
      } else {
        const [op] = batch.ops
        let photoId = null
        const dataUrl = await Promise.resolve(readPhoto?.(op.id)).catch(() => null)
        if (dataUrl) {
          try {
            const res = await api('uploadPhoto', { id: op.id, dataUrl })
            photoId = res?.photoId ?? null
          } catch (err) {
            if (!isRefusal(err)) throw err
            notify(`A label photo couldn’t be uploaded: ${err.message}`, 'error')
          }
        }
        outbox = removeSent(store.read(OUTBOX_KEY, outbox), [op])
        store.write(OUTBOX_KEY, outbox)
        if (photoId && sheet) {
          sheet = { ...sheet, items: sheet.items.map((s) => (s.id === op.id ? { ...s, photoId, hasPhoto: true } : s)) }
          sheetGen++
          store.write(SHEET_KEY, sheet)
        }
      }
      emit()
    }
  }

  /** Loads the list when it changed in the sheet (or was never loaded). */
  async function pull() {
    const gen = sheetGen
    if (sheet) {
      const version = await api('getVersion')
      if (version === sheet.version) return
    }
    const res = await api('getItems')
    if (gen !== sheetGen) return // a newer copy arrived meanwhile
    setSheet(res)
    emit()
  }

  let running = null
  let again = false
  let wantPull = false
  let retryMs = 0

  function pump() {
    if (timer) clearTimer(timer)
    timer = null
    if (locked) return Promise.resolve()
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      setState('busy')
      try {
        do {
          again = false
          await lock(async () => {
            const sent = await sendOutbox()
            // A send answers with the whole list, so there is nothing more to fetch.
            if ((wantPull && !sent) || !sheet) await pull()
            wantPull = false
          })
        } while (again)
        retryMs = 0
        setState('ok')
      } catch (err) {
        if (err.auth) {
          locked = true
          lockId++
          setState('locked', err.message)
        } else {
          setState(err.offline || !isOnline() ? 'offline' : 'error', err.message || String(err))
          retryMs = Math.min(Math.max(retryMs * 2, 5000), MAX_RETRY_MS)
          schedule(retryMs)
        }
      }
    })().finally(() => {
      running = null
    })
    return running
  }

  /** Sends what's waiting and checks the sheet for changes. */
  function sync() {
    wantPull = true
    return pump()
  }

  /** Checks the password with the sheet. Throws (and forgets it) when it's wrong. */
  async function unlock(password) {
    savePassword(password)
    try {
      await api('getVersion')
    } catch (err) {
      if (err.auth) {
        savePassword('')
        throw err
      }
      // Offline: the password can't be checked yet. Keep it; the next sync will tell.
    }
    locked = false
    setState('ok')
    return sync()
  }

  let started = false
  function start() {
    if (started || typeof window === 'undefined') return
    started = true
    migrate()
    sync()
    let lastLook = Date.now()
    const look = () => {
      lastLook = Date.now()
      sync()
    }
    setInterval(() => {
      if (document.visibilityState !== 'hidden') look()
    }, POLL_MS)
    window.addEventListener('online', look)
    // Coming back to the app (another tab, another window, the phone's home screen) checks at once,
    // but not more than every few seconds.
    const lookSoon = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLook > 5000) look()
    }
    document.addEventListener('visibilitychange', lookSoon)
    window.addEventListener('focus', lookSoon)
    // Another tab sent or queued changes.
    window.addEventListener('storage', (e) => {
      if (e.key !== null && e.key !== SHEET_KEY && e.key !== OUTBOX_KEY) return
      sheet = store.read(SHEET_KEY, null)
      sheetGen++
      outbox = store.read(OUTBOX_KEY, [])
      emit()
    })
  }

  return {
    subscribe(fn) {
      start()
      return subs.subscribe(fn)
    },
    getSnapshot: () => snap,
    add,
    update,
    remove,
    sync,
    unlock,
    migrate,
    /** `fn(message, type)` shows a notice, e.g. the toast. */
    setNotify(fn) {
      notify = fn
      early.splice(0).forEach((args) => fn(...args))
    },
  }
}

/** The list kept in this browser only (npm run dev, or no server set up). */
export function createLocalStock({ storage = globalThis.localStorage, forgetPhotos = async () => {} } = {}) {
  const store = reader(storage)
  const subs = listeners()
  let scans = store.read(SCANS_KEY, [])
  let snap = { mode: 'local', scans, loaded: true, state: 'ok', error: '', pending: 0, lockId: 0 }

  const set = (next) => {
    scans = next
    store.write(SCANS_KEY, scans)
    snap = { ...snap, scans }
    subs.emit()
  }

  return {
    subscribe: subs.subscribe,
    getSnapshot: () => snap,
    add: (scan) => set([scan, ...scans]),
    update: (id, patch) => set(scans.map((s) => (s.id === id ? { ...s, ...patch } : s))),
    remove(ids) {
      const gone = new Set(ids)
      const withPhoto = scans.filter((s) => s.hasPhoto && gone.has(s.id)).map((s) => s.id)
      set(scans.filter((s) => !gone.has(s.id)))
      // The item is gone either way; a photo left behind only takes space.
      if (withPhoto.length) forgetPhotos(withPhoto).catch(() => {})
    },
    sync: () => Promise.resolve(),
    unlock: () => Promise.resolve(),
    migrate: () => 0,
    setNotify() {},
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** The app's one stock list. */
export const stock = isRemote
  ? createStockSync({
      call,
      readPhoto: async (id) => {
        const blob = await getPhoto(id)
        return blob ? blobToDataUrl(blob) : null
      },
      forgetPhotos: deletePhotos,
      needsPassword: () => !hasPassword(),
      savePassword: setPassword,
      lock: (fn) => (globalThis.navigator?.locks?.request ? navigator.locks.request('it-stock-sync', fn) : fn()),
    })
  : createLocalStock({ forgetPhotos: deletePhotos })

/** The current list and sync status: { mode, scans, loaded, state, error, pending, lockId }. */
export function useStock() {
  return useSyncExternalStore(stock.subscribe, stock.getSnapshot)
}
