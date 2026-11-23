import { describe, expect, it } from 'vitest'
import { createDrafts } from './drafts.js'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    keys: () => [...data.keys()],
  }
}

function memoryPhotos() {
  const data = new Map()
  return {
    data,
    save: async (id, blob) => void data.set(id, blob),
    get: async (id) => data.get(id),
    remove: async (ids) => ids.forEach((id) => data.delete(id)),
  }
}

function setup() {
  const storage = memoryStorage()
  const photos = memoryPhotos()
  let t = 0
  const now = () => `2026-11-23T08:00:${String(t++).padStart(2, '0')}.000Z`
  return { storage, photos, drafts: createDrafts({ storage, photos, now }) }
}

const pending = (id, source = 'manual') => ({ id, serial: 'ABC', model: '', color: '', source })
const values = { serial: 'ABC1', name: 'Dell', user: '', model: '', color: '', location: 'B', note: '' }

describe('drafts', () => {
  it('has nothing to restore at first', () => {
    const { drafts } = setup()
    expect(drafts.load('scanner')).toBeNull()
    expect(drafts.latestPage()).toBeNull()
  })

  it('keeps the form as it opened, then the typed fields', async () => {
    const { drafts } = setup()
    await drafts.start('scanner', pending('a1'))
    expect(drafts.load('scanner')).toMatchObject({ pending: pending('a1'), values: null, hasPhoto: false })
    drafts.update('scanner', 'a1', values)
    expect(drafts.load('scanner').values).toEqual(values)
  })

  it('ignores typing from a form that was already replaced', async () => {
    const { drafts } = setup()
    await drafts.start('scanner', pending('old'))
    await drafts.start('scanner', pending('new'))
    drafts.update('scanner', 'old', values)
    expect(drafts.load('scanner')).toMatchObject({ pending: { id: 'new' }, values: null })
  })

  it('stores the photo outside the fields, and gives it back', async () => {
    const { drafts, storage, photos } = setup()
    const blob = { fake: 'jpeg' }
    await drafts.start('photo', pending('p1', 'photo'), blob)
    expect(await drafts.photo('photo')).toBe(blob)
    expect(drafts.load('photo').hasPhoto).toBe(true)
    expect(storage.getItem('it-stock-draft-v1-photo')).not.toContain('jpeg')
    expect([...photos.data.keys()]).toEqual(['draft-photo'])
  })

  it('clear removes the draft and its photo', async () => {
    const { drafts, photos } = setup()
    await drafts.start('photo', pending('p1', 'photo'), { fake: 'jpeg' })
    drafts.clear('photo')
    await Promise.resolve()
    expect(drafts.load('photo')).toBeNull()
    expect(photos.data.size).toBe(0)
    expect(await drafts.photo('photo')).toBeNull()
  })

  it('keeps one draft per page', async () => {
    const { drafts } = setup()
    await drafts.start('photo', pending('p1', 'photo'), { fake: 'jpeg' })
    await drafts.start('scanner', pending('s1'))
    drafts.clear('scanner')
    expect(drafts.load('photo')).toMatchObject({ pending: { id: 'p1' } })
  })

  it('latestPage is the page touched last', async () => {
    const { drafts } = setup()
    await drafts.start('photo', pending('p1', 'photo'), { fake: 'jpeg' })
    await drafts.start('scanner', pending('s1'))
    expect(drafts.latestPage()).toBe('scanner')
    drafts.update('photo', 'p1', values)
    expect(drafts.latestPage()).toBe('photo')
  })

  it('treats a damaged draft as none', () => {
    const { drafts, storage } = setup()
    storage.setItem('it-stock-draft-v1-scanner', '{not json')
    expect(drafts.load('scanner')).toBeNull()
    storage.setItem('it-stock-draft-v1-scanner', JSON.stringify({ values }))
    expect(drafts.load('scanner')).toBeNull()
  })

  it('still works when storage is blocked', async () => {
    const blocked = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
      removeItem() {
        throw new Error('blocked')
      },
    }
    const drafts = createDrafts({ storage: blocked, photos: memoryPhotos() })
    await drafts.start('scanner', pending('a1'))
    drafts.update('scanner', 'a1', values)
    drafts.clear('scanner')
    expect(drafts.load('scanner')).toBeNull()
  })
})
