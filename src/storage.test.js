import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { itemName, csvRow, CSV_HEADER, searchValues, inLocation, locationGroups, locationKey, CATEGORIES, tidyCategory, categoryKey, categoryGroups, inCategory, categoryColor } from './storage.js'

describe('itemName', () => {
  it('falls back to legacy type', () => expect(itemName({ type: 'Laptop' })).toBe('Laptop'))
  it('prefers name', () => expect(itemName({ name: 'Dell', type: 'Laptop' })).toBe('Dell'))
  it('empty when neither', () => expect(itemName({})).toBe(''))
})

describe('csvRow', () => {
  it('has the expected header', () =>
    expect(CSV_HEADER).toEqual(['Serial number', 'Category', 'Name', 'User', 'Model', 'Color', 'Location', 'Note', 'Method', 'Scanned at']))

  it('maps a new record', () => {
    const row = csvRow({
      serial: '1', category: 'Monitor', name: 'Dell', user: 'Ana Reyes', model: '5420', color: 'Black', location: 'B', note: '',
      source: 'camera', scannedAt: '2026-11-21T10:00:00Z',
    })
    expect(row.slice(0, 9)).toEqual(['1', 'Monitor', 'Dell', 'Ana Reyes', '5420', 'Black', 'B', '', 'Camera'])
  })

  it('leaves User and Category blank for records saved before they existed', () => {
    const row = csvRow({ serial: '2', name: 'Dell', model: '5420', source: 'manual', scannedAt: '2026-11-21T10:00:00Z' })
    expect(row[1]).toBe('')
    expect(row[3]).toBe('')
    expect(row[4]).toBe('5420')
  })

  it('maps a legacy record without blanks for name', () => {
    const row = csvRow({ serial: '2', type: 'Monitor', source: 'manual', scannedAt: '2026-11-21T10:00:00Z' })
    expect(row[2]).toBe('Monitor')
    expect(row[4]).toBe('')
    expect(row[8]).toBe('Typed')
  })

  it('labels a photo record', () => {
    const row = csvRow({ serial: '3', name: 'HP', source: 'photo', hasPhoto: true, scannedAt: '2026-11-21T10:00:00Z' })
    expect(row[8]).toBe('Photo')
  })

  it('writes a category in the list’s spelling', () =>
    expect(csvRow({ serial: '4', category: ' graphics  CARD ', scannedAt: '2026-11-21T10:00:00Z' })[1]).toBe('Graphics card'))
})

describe('searchValues', () => {
  it('includes the user, so items can be found by who uses them', () =>
    expect(searchValues({ serial: '1', name: 'Dell', user: 'Ana Reyes' })).toContain('Ana Reyes'))

  it('uses the legacy type as the name', () => expect(searchValues({ type: 'Monitor' })).toContain('Monitor'))

  it('includes the category', () => expect(searchValues({ category: 'RAM' })).toContain('RAM'))
})

describe('categories', () => {
  const of = (category, id = category) => ({ id, category })

  it('has the kinds of item asked for, then Other', () =>
    expect(CATEGORIES).toEqual(['Keyboard', 'Mouse', 'Monitor', 'RAM', 'Processor', 'Graphics card', 'Storage', 'Motherboard', 'Other']))

  it('spells a listed category the list’s way and keeps others as typed', () => {
    expect(tidyCategory('ram')).toBe('RAM')
    expect(tidyCategory('  mother board ')).toBe('mother board') // not in the list: kept, tidied
    expect(tidyCategory('MOTHERBOARD')).toBe('Motherboard')
    expect(tidyCategory(' Laptop  stand ')).toBe('Laptop stand')
    expect(tidyCategory(undefined)).toBe('')
    expect(categoryKey(' Graphics   Card')).toBe('graphics card')
  })

  it('groups in list order, unlisted ones before Other, no category last', () => {
    const scans = [of(''), of('other', 'o'), of('Laptop'), of('ram', 'r1'), of('RAM', 'r2'), of('Mouse'), of(undefined, 'u'), of('Keyboard')]
    expect(categoryGroups(scans)).toEqual([
      { key: 'keyboard', label: 'Keyboard', count: 1 },
      { key: 'mouse', label: 'Mouse', count: 1 },
      { key: 'ram', label: 'RAM', count: 2 },
      { key: 'laptop', label: 'Laptop', count: 1 },
      { key: 'other', label: 'Other', count: 1 },
      { key: '', label: 'No category', count: 2 },
    ])
  })

  it('filters by category key, or not at all for null', () => {
    const scans = [of('RAM', 'a'), of('ram ', 'b'), of('Mouse', 'c'), of('', 'd')]
    expect(inCategory(scans, 'ram').map((s) => s.id)).toEqual(['a', 'b'])
    expect(inCategory(scans, '').map((s) => s.id)).toEqual(['d'])
    expect(inCategory(scans, null)).toBe(scans)
  })
})

describe('location tabs', () => {
  const at = (location, id = location) => ({ id, location })

  it('treats case and extra spaces as the same place', () => {
    expect(locationKey('  Stockroom   B ')).toBe('stockroom b')
    expect(locationKey(undefined)).toBe('')
  })

  it('groups by place, sorted by name, with no location last', () => {
    const scans = [at('Office 10'), at(''), at('office 2'), at('Office 2', 'x'), at('Annex'), at(undefined, 'y'), at('  ', 'z')]
    expect(locationGroups(scans)).toEqual([
      { key: 'annex', label: 'Annex', count: 1 },
      { key: 'office 2', label: 'office 2', count: 2 },
      { key: 'office 10', label: 'Office 10', count: 1 },
      { key: '', label: 'No location', count: 3 },
    ])
  })

  it('shows a place with its most used spelling', () => {
    const scans = [at('stockroom b', 1), at('Stockroom B', 2), at('Stockroom  B', 3)]
    expect(locationGroups(scans)[0]).toMatchObject({ label: 'Stockroom B', count: 3 })
  })

  it('has no groups for an empty list', () => expect(locationGroups([])).toEqual([]))

  it('filters to one place, or keeps all for null', () => {
    const scans = [at('Annex'), at('ANNEX ', 'b'), at('Office'), at('', 'n')]
    expect(inLocation(scans, 'annex').map((s) => s.id)).toEqual(['Annex', 'b'])
    expect(inLocation(scans, '').map((s) => s.id)).toEqual(['n'])
    expect(inLocation(scans, null)).toBe(scans)
  })
})

describe('categoryColor', () => {
  it('gives each category its own color token', () => {
    expect(categoryColor('Keyboard')).toBe('var(--cat-keyboard)')
    expect(categoryColor(' graphics  CARD ')).toBe('var(--cat-graphics-card)')
  })

  it('has a token for every category in the list', () => {
    const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')
    for (const c of CATEGORIES) {
      const token = categoryColor(c).slice(4, -1)
      expect(css.match(new RegExp(`${token}:`, 'g'))?.length, token).toBe(2) // light and dark
    }
  })

  it('is gray for a category typed into the sheet, and none without one', () => {
    expect(categoryColor('Docking station')).toBe('var(--cat-other)')
    expect(categoryColor('  ')).toBeNull()
    expect(categoryColor(undefined)).toBeNull()
  })
})
