import { describe, it, expect } from 'vitest'
import { itemName, csvRow, CSV_HEADER, searchValues, inLocation, locationGroups, locationKey } from './storage.js'

describe('itemName', () => {
  it('falls back to legacy type', () => expect(itemName({ type: 'Laptop' })).toBe('Laptop'))
  it('prefers name', () => expect(itemName({ name: 'Dell', type: 'Laptop' })).toBe('Dell'))
  it('empty when neither', () => expect(itemName({})).toBe(''))
})

describe('csvRow', () => {
  it('has the expected header', () =>
    expect(CSV_HEADER).toEqual(['Serial number', 'Name', 'User', 'Model', 'Color', 'Location', 'Note', 'Method', 'Scanned at']))

  it('maps a new record', () => {
    const row = csvRow({
      serial: '1', name: 'Dell', user: 'Ana Reyes', model: '5420', color: 'Black', location: 'B', note: '',
      source: 'camera', scannedAt: '2026-11-21T10:00:00Z',
    })
    expect(row.slice(0, 8)).toEqual(['1', 'Dell', 'Ana Reyes', '5420', 'Black', 'B', '', 'Camera'])
  })

  it('leaves User blank for records saved before it existed', () => {
    const row = csvRow({ serial: '2', name: 'Dell', model: '5420', source: 'manual', scannedAt: '2026-11-21T10:00:00Z' })
    expect(row[2]).toBe('')
    expect(row[3]).toBe('5420')
  })

  it('maps a legacy record without blanks for name', () => {
    const row = csvRow({ serial: '2', type: 'Monitor', source: 'manual', scannedAt: '2026-11-21T10:00:00Z' })
    expect(row[1]).toBe('Monitor')
    expect(row[3]).toBe('')
    expect(row[7]).toBe('Typed')
  })

  it('labels a photo record', () => {
    const row = csvRow({ serial: '3', name: 'HP', source: 'photo', hasPhoto: true, scannedAt: '2026-11-21T10:00:00Z' })
    expect(row[7]).toBe('Photo')
  })
})

describe('searchValues', () => {
  it('includes the user, so items can be found by who uses them', () =>
    expect(searchValues({ serial: '1', name: 'Dell', user: 'Ana Reyes' })).toContain('Ana Reyes'))

  it('uses the legacy type as the name', () => expect(searchValues({ type: 'Monitor' })).toContain('Monitor'))
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
