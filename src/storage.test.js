import { describe, it, expect } from 'vitest'
import { itemName, csvRow, CSV_HEADER } from './storage.js'

describe('itemName', () => {
  it('falls back to legacy type', () => expect(itemName({ type: 'Laptop' })).toBe('Laptop'))
  it('prefers name', () => expect(itemName({ name: 'Dell', type: 'Laptop' })).toBe('Dell'))
  it('empty when neither', () => expect(itemName({})).toBe(''))
})

describe('csvRow', () => {
  it('has the expected header', () =>
    expect(CSV_HEADER).toEqual(['Serial number', 'Name', 'Model', 'Color', 'Location', 'Note', 'Method', 'Scanned at']))

  it('maps a new record', () => {
    const row = csvRow({
      serial: '1', name: 'Dell', model: '5420', color: 'Black', location: 'B', note: '',
      source: 'camera', scannedAt: '2026-11-21T10:00:00Z',
    })
    expect(row.slice(0, 7)).toEqual(['1', 'Dell', '5420', 'Black', 'B', '', 'Camera'])
  })

  it('maps a legacy record without blanks for name', () => {
    const row = csvRow({ serial: '2', type: 'Monitor', source: 'manual', scannedAt: '2026-11-21T10:00:00Z' })
    expect(row[1]).toBe('Monitor')
    expect(row[2]).toBe('')
    expect(row[6]).toBe('Typed')
  })
})
