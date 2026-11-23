import { describe, it, expect, vi } from 'vitest'
import { EDIT_KEYS, createLocalStock, createStockSync } from './stock.js'

/** localStorage stand-in. */
function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    json: (k) => JSON.parse(m.get(k) ?? 'null'),
  }
}

const err = (message, extra) => Object.assign(new Error(message), extra)

/**
 * A stand-in for code.gs with the same rules: adds replace, updates skip missing rows, deletes are
 * quiet. `fields` is what it says it stores; an older Code.gs said nothing.
 */
function fakeSheet({ fields = EDIT_KEYS } = {}) {
  const rows = new Map()
  let version = 1
  let fail = null
  const calls = []
  const list = () => [...rows.values()].map((r) => ({ ...r }))
  async function api(fn, ...args) {
    calls.push(fn)
    if (fail) throw fail
    if (fn === 'getItems') return { items: list(), version: String(version), fields }
    if (fn === 'getVersion') return String(version)
    if (fn === 'applyChanges') {
      for (const o of args[0]) {
        if (o.op === 'add') rows.set(o.id, { ...rows.get(o.id), ...o.item, id: o.id, hasPhoto: rows.get(o.id)?.hasPhoto ?? false })
        else if (o.op === 'update' && rows.has(o.id)) rows.set(o.id, { ...rows.get(o.id), ...o.patch })
        else if (o.op === 'delete') rows.delete(o.id)
      }
      version++
      return { items: list(), version: String(version), fields, skipped: [] }
    }
    if (fn === 'uploadPhoto') {
      const row = rows.get(args[0].id)
      if (!row) return { photoId: null }
      Object.assign(row, { photoId: `photo-${row.id}`, hasPhoto: true })
      version++
      return { photoId: row.photoId }
    }
    throw err(`Unknown function: ${fn}`, { status: 400 })
  }
  return {
    rows,
    calls,
    api: vi.fn(api),
    fail: (e) => (fail = e),
    /** Someone edits the sheet by hand. */
    edit(id, patch) {
      rows.set(id, { ...rows.get(id), ...patch })
      version++
    },
  }
}

let n = 0
const scan = (id, extra = {}) => ({
  id,
  serial: `SN${id}`,
  name: 'Laptop',
  user: '',
  model: '',
  color: '',
  location: 'Stockroom',
  note: '',
  source: 'camera',
  scannedAt: `2026-11-23T0${n++ % 10}:00:00.000Z`,
  ...extra,
})

function setup({ storage = memoryStorage(), sheet = fakeSheet(), ...options } = {}) {
  const stock = createStockSync({
    call: sheet.api,
    storage,
    readPhoto: async () => 'data:image/jpeg;base64,AAAA',
    setTimer: () => 0, // the tests send by calling sync()
    clearTimer: () => {},
    ...options,
  })
  return { stock, sheet, storage, snap: () => stock.getSnapshot() }
}

describe('createStockSync', () => {
  it('shows a new scan at once and sends it to the sheet', async () => {
    const { stock, sheet, snap } = setup()
    stock.add(scan('a1'))
    expect(snap().scans.map((s) => s.id)).toEqual(['a1'])
    expect(snap().pending).toBe(1)

    await stock.sync()
    expect(sheet.rows.get('a1').serial).toBe('SNa1')
    expect(snap()).toMatchObject({ pending: 0, state: 'ok', loaded: true })
  })

  it('keeps changes made offline, across a reload, and sends them later', async () => {
    const storage = memoryStorage()
    const sheet = fakeSheet()
    const first = setup({ storage, sheet })
    await first.stock.sync() // loads the (empty) list
    sheet.fail(err('Can’t reach the server.', { offline: true }))
    first.stock.add(scan('b1'))
    await first.stock.sync()
    expect(first.snap()).toMatchObject({ state: 'offline', pending: 1 })

    // The page is closed and opened again, still offline.
    const second = setup({ storage, sheet })
    expect(second.snap().scans.map((s) => s.id)).toEqual(['b1'])

    sheet.fail(null)
    await second.stock.sync()
    expect(sheet.rows.has('b1')).toBe(true)
    expect(second.snap()).toMatchObject({ state: 'ok', pending: 0 })
  })

  it('starts logged out when there is no password yet, and sends nothing', async () => {
    const { stock, sheet, snap } = setup({ needsPassword: () => true })
    expect(snap()).toMatchObject({ state: 'locked', error: '' })
    await stock.sync()
    expect(sheet.calls).toEqual([])
  })

  it('logs in only with the right password', async () => {
    const savePassword = vi.fn()
    const sheet = fakeSheet()
    const api = sheet.api.getMockImplementation()
    let right = false
    sheet.api.mockImplementation((fn, ...args) => (right ? api(fn, ...args) : Promise.reject(err('Wrong password.', { auth: true }))))
    const { stock, snap } = setup({ sheet, savePassword, needsPassword: () => true })

    await expect(stock.login('nope')).rejects.toMatchObject({ auth: true })
    expect(savePassword).not.toHaveBeenCalled() // a wrong password is never remembered
    expect(snap().state).toBe('locked')

    right = true
    await stock.login('right')
    expect(savePassword).toHaveBeenLastCalledWith('right')
    expect(snap().state).not.toBe('locked')
    await stock.sync()
    expect(snap()).toMatchObject({ state: 'ok', loaded: true })
  })

  it('does not log in when the password can’t be checked', async () => {
    const savePassword = vi.fn()
    const { stock, sheet, snap } = setup({ savePassword, needsPassword: () => true })
    sheet.fail(err('Can’t reach the server.', { offline: true }))
    await expect(stock.login('maybe')).rejects.toMatchObject({ offline: true })
    expect(savePassword).not.toHaveBeenCalled()
    expect(snap().state).toBe('locked')
  })

  it('logs out when the password is changed, keeping changes for the next login', async () => {
    const { stock, sheet, snap } = setup()
    sheet.fail(err('Wrong password.', { auth: true }))
    stock.add(scan('c1'))
    await stock.sync()
    expect(snap()).toMatchObject({ state: 'locked', error: expect.stringMatching(/password was changed/), pending: 1 })

    sheet.fail(null)
    await stock.login('new password')
    await stock.sync()
    expect(sheet.rows.has('c1')).toBe(true)
    expect(snap()).toMatchObject({ state: 'ok', pending: 0, error: '' })
  })

  it('log out forgets the password and the list, but keeps unsent changes', async () => {
    const savePassword = vi.fn()
    const forgetPhotos = vi.fn(async () => {})
    const { stock, sheet, snap, storage } = setup({ savePassword, forgetPhotos })
    stock.add(scan('l1', { hasPhoto: true }))
    await stock.sync() // l1 and its photo are on the sheet
    sheet.fail(err('Can’t reach the server.', { offline: true }))
    stock.add(scan('l2', { hasPhoto: true })) // not sent yet
    await stock.sync()

    stock.logout()
    expect(savePassword).toHaveBeenLastCalledWith('')
    expect(snap()).toMatchObject({ state: 'locked', error: '', loaded: false, pending: 2 })
    expect(storage.getItem('it-stock-sheet-v1')).toBeNull()
    // The downloaded copy of l1's photo goes; l2's photo still has to be uploaded.
    expect(forgetPhotos).toHaveBeenLastCalledWith(['l1'])

    sheet.fail(null)
    await stock.sync() // logged out: nothing is sent
    expect(sheet.rows.has('l2')).toBe(false)
    await stock.login('pw')
    await stock.sync()
    expect(sheet.rows.get('l2').photoId).toBe('photo-l2')
  })

  it('a request that finishes after log out does not bring the list back', async () => {
    const sheet = fakeSheet()
    const api = sheet.api.getMockImplementation()
    let release
    const gate = new Promise((r) => (release = r))
    sheet.api.mockImplementation(async (fn, ...args) => {
      if (fn === 'getItems') await gate
      return api(fn, ...args)
    })
    const { stock, snap, storage } = setup({ sheet })
    const loading = stock.sync()
    await Promise.resolve()
    stock.logout()
    release()
    await loading
    expect(snap()).toMatchObject({ state: 'locked', loaded: false })
    expect(storage.getItem('it-stock-sheet-v1')).toBeNull()
  })

  it('uploads the label photo after the item', async () => {
    const { stock, sheet, snap } = setup()
    stock.add(scan('d1', { source: 'photo', hasPhoto: true }))
    expect(snap().scans[0].hasPhoto).toBe(true)

    await stock.sync()
    expect(sheet.calls.filter((c) => c !== 'getItems')).toEqual(['applyChanges', 'uploadPhoto'])
    expect(snap().scans[0]).toMatchObject({ hasPhoto: true, photoId: 'photo-d1' })
    expect(snap().pending).toBe(0)
  })

  it('says once when the sheet’s Code.gs is too old to store a field', async () => {
    const notices = []
    const sheet = fakeSheet({ fields: null }) // Code.gs from before Category
    const { stock } = setup({ sheet })
    stock.setNotify((m, type) => notices.push([m, type]))
    stock.add(scan('o1', { category: 'Monitor' }))
    await stock.sync()
    stock.update('o1', { category: 'RAM' })
    await stock.sync()
    expect(notices).toHaveLength(1)
    expect(notices[0][0]).toMatch(/Code\.gs is older than this app, so Category isn’t saved in the sheet\./)
    expect(notices[0][1]).toBe('error')

    // A Code.gs that stores every field the app sends: no notice.
    const quiet = []
    const fresh = setup()
    fresh.stock.setNotify((m) => quiet.push(m))
    fresh.stock.add(scan('o2', { category: 'Monitor' }))
    await fresh.stock.sync()
    expect(quiet).toEqual([])
    expect(fresh.sheet.rows.get('o2').category).toBe('Monitor')
  })

  it('drops a photo the sheet refuses and carries on', async () => {
    const notices = []
    const sheet = fakeSheet()
    const api = sheet.api.getMockImplementation()
    sheet.api.mockImplementation((fn, ...args) =>
      fn === 'uploadPhoto' ? Promise.reject(err('That photo is too large.', { status: 400 })) : api(fn, ...args),
    )
    const { stock, snap } = setup({ sheet })
    stock.setNotify((m) => notices.push(m))
    stock.add(scan('e1', { hasPhoto: true }))
    await stock.sync()
    expect(snap()).toMatchObject({ state: 'ok', pending: 0 })
    expect(notices[0]).toMatch(/too large/)
  })

  it('keeps a photo waiting when the upload fails for a passing reason', async () => {
    const sheet = fakeSheet()
    const api = sheet.api.getMockImplementation()
    sheet.api.mockImplementation((fn, ...args) =>
      fn === 'uploadPhoto' ? Promise.reject(err('Google Sheets did not answer.', { status: 502 })) : api(fn, ...args),
    )
    const { stock, snap } = setup({ sheet })
    stock.add(scan('e2', { hasPhoto: true }))
    await stock.sync()
    expect(snap()).toMatchObject({ state: 'error', pending: 1, error: 'Google Sheets did not answer.' })
    expect(sheet.rows.has('e2')).toBe(true) // the item itself got there
  })

  it('sends only the fields that changed', async () => {
    const { stock, sheet, storage } = setup()
    stock.add(scan('f1'))
    await stock.sync()
    sheet.edit('f1', { location: 'Edited in the sheet' })
    await stock.sync()

    // The details panel saves every field; only the user really changed.
    const current = stock.getSnapshot().scans[0]
    stock.update('f1', { ...current, user: 'Ana Reyes' })
    expect(storage.json('it-stock-outbox-v1')).toEqual([expect.objectContaining({ op: 'update', patch: { user: 'Ana Reyes' } })])
    await stock.sync()
    expect(sheet.rows.get('f1')).toMatchObject({ user: 'Ana Reyes', location: 'Edited in the sheet' })

    stock.update('f1', { ...stock.getSnapshot().scans[0] }) // nothing changed: nothing queued
    expect(storage.json('it-stock-outbox-v1')).toEqual([])
  })

  it('does not lose an edit made while a send is on its way', async () => {
    const sheet = fakeSheet()
    const api = sheet.api.getMockImplementation()
    let release
    const gate = new Promise((r) => (release = r))
    sheet.api.mockImplementation(async (fn, ...args) => {
      if (fn === 'applyChanges' && !sheet.rows.has('g1')) await gate
      return api(fn, ...args)
    })
    const { stock, snap } = setup({ sheet })
    stock.add(scan('g1'))
    const sending = stock.sync()
    await Promise.resolve()
    stock.update('g1', { note: 'Charger missing' }) // folds into the add that is being sent
    release()
    await sending
    expect(sheet.rows.get('g1').note).toBe('Charger missing')
    expect(snap().pending).toBe(0)
  })

  it('removes deleted items from the list, the sheet and this device', async () => {
    const forgetPhotos = vi.fn(async () => {})
    const { stock, sheet, snap } = setup({ forgetPhotos })
    stock.add(scan('h1'))
    stock.add(scan('h2'))
    await stock.sync()
    stock.remove(['h1'])
    expect(snap().scans.map((s) => s.id)).toEqual(['h2'])
    expect(forgetPhotos).toHaveBeenCalledWith(['h1'])
    await stock.sync()
    expect([...sheet.rows.keys()]).toEqual(['h2'])
  })

  it('picks up changes made in the sheet or by other devices', async () => {
    const { stock, sheet, snap } = setup()
    stock.add(scan('i1'))
    await stock.sync()
    sheet.edit('i1', { user: 'Marco Santos' })
    sheet.rows.set('i2', { ...scan('i2'), hasPhoto: false })
    await stock.sync()
    expect(snap().scans.find((s) => s.id === 'i1').user).toBe('Marco Santos')
    expect(snap().scans).toHaveLength(2)
  })

  it('only asks for the version when nothing changed', async () => {
    const { stock, sheet } = setup()
    await stock.sync()
    sheet.calls.length = 0
    await stock.sync()
    expect(sheet.calls).toEqual(['getVersion'])
  })

  it('moves scans saved before the sheet was connected, oldest first, photos last', async () => {
    const old = [scan('j2', { hasPhoto: true }), { ...scan('j1'), name: undefined, type: 'Monitor' }] // newest first
    const storage = memoryStorage({ 'it-stock-scans-v1': JSON.stringify(old) })
    const { stock, sheet } = setup({ storage })
    const notices = []
    stock.setNotify((m) => notices.push(m)) // still shown, though the move happened before anyone listened
    expect(stock.migrate()).toBe(2)
    expect(storage.getItem('it-stock-scans-v1')).toBeNull()
    expect(storage.json('it-stock-outbox-v1').map((o) => `${o.op} ${o.id}`)).toEqual(['add j1', 'add j2', 'photo j2'])
    expect(notices).toEqual(['2 scans saved on this device before the Google Sheet was connected will be added to it.'])

    await stock.sync()
    expect([...sheet.rows.keys()]).toEqual(['j1', 'j2'])
    expect(sheet.rows.get('j1').name).toBe('Monitor')
    expect(sheet.rows.get('j2').photoId).toBe('photo-j2')
  })
})

describe('createLocalStock', () => {
  it('keeps the list in this browser', () => {
    const storage = memoryStorage()
    const forgetPhotos = vi.fn(async () => {})
    const local = createLocalStock({ storage, forgetPhotos })
    local.add(scan('k1', { hasPhoto: true }))
    local.update('k1', { user: 'Ana' })
    expect(storage.json('it-stock-scans-v1')[0].user).toBe('Ana')
    local.remove(['k1'])
    expect(local.getSnapshot().scans).toEqual([])
    expect(forgetPhotos).toHaveBeenCalledWith(['k1'])
  })
})
