import { describe, it, expect } from 'vitest'
import { itemName, csvRow, CSV_HEADER, searchValues } from './storage.js'

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
