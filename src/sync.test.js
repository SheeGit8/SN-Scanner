import { describe, it, expect } from 'vitest'
import { applyOps, itemForSheet, queueOp, removeSent, sortNewestFirst, takeBatch } from './sync.js'

const item = (id, extra = {}) => ({ id, serial: `S${id}`, name: `Item ${id}`, scannedAt: `2026-11-2${id}T00:00:00.000Z`, ...extra })

describe('applyOps', () => {
  it('adds new items', () => {
    expect(applyOps([item('1')], [{ op: 'add', id: '2', item: item('2') }]).map((s) => s.id)).toEqual(['2', '1'])
  })

  it('replaces an item that is already there (a retried add)', () => {
    const out = applyOps([item('1')], [{ op: 'add', id: '1', item: item('1', { name: 'New' }) }])
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('New')
  })

  it('patches and deletes', () => {
    const out = applyOps(
      [item('1'), item('2')],
      [
        { op: 'update', id: '1', patch: { user: 'Ana' } },
        { op: 'delete', id: '2' },
      ],
    )
    expect(out).toEqual([{ ...item('1'), user: 'Ana' }])
  })

  it('ignores an update for an item someone else deleted', () => {
    expect(applyOps([item('1')], [{ op: 'update', id: '9', patch: { user: 'Ana' } }])).toEqual([item('1')])
  })

  it('marks an item whose photo is still uploading as having one', () => {
    expect(applyOps([item('1')], [{ op: 'photo', id: '1' }])[0].hasPhoto).toBe(true)
  })

  it('gives the same result when applied twice', () => {
    const ops = [
      { op: 'add', id: '3', item: item('3') },
      { op: 'update', id: '1', patch: { note: 'x' } },
      { op: 'delete', id: '2' },
      { op: 'photo', id: '3' },
    ]
    const once = applyOps([item('1'), item('2')], ops)
    expect(applyOps(once, ops)).toEqual(once)
  })
})

describe('queueOp', () => {
  it('folds an update into a queued add, taking the update’s key', () => {
    const out = queueOp([{ key: 'a', op: 'add', id: '1', item: item('1') }], { key: 'b', op: 'update', id: '1', patch: { user: 'Ana' } })
    expect(out).toEqual([{ key: 'b', op: 'add', id: '1', item: { ...item('1'), user: 'Ana' } }])
  })

  it('merges updates to the same item', () => {
    const out = queueOp([{ key: 'a', op: 'update', id: '1', patch: { user: 'Ana' } }], { key: 'b', op: 'update', id: '1', patch: { note: 'x' } })
    expect(out).toEqual([{ key: 'b', op: 'update', id: '1', patch: { user: 'Ana', note: 'x' } }])
  })

  it('drops queued changes to a deleted item but still sends the delete', () => {
    const out = queueOp(
      [
        { key: 'a', op: 'add', id: '1', item: item('1') },
        { key: 'b', op: 'photo', id: '1' },
        { key: 'c', op: 'update', id: '2', patch: { note: 'y' } },
      ],
      { key: 'd', op: 'delete', id: '1' },
    )
    expect(out).toEqual([
      { key: 'c', op: 'update', id: '2', patch: { note: 'y' } },
      { key: 'd', op: 'delete', id: '1' },
    ])
  })

  it('does not fold an update into a delete or a photo', () => {
    const del = [{ key: 'a', op: 'delete', id: '1' }]
    expect(queueOp(del, { key: 'b', op: 'update', id: '1', patch: { note: 'y' } })).toHaveLength(2)
    const photo = [{ key: 'a', op: 'photo', id: '1' }]
    expect(queueOp(photo, { key: 'b', op: 'update', id: '1', patch: { note: 'y' } })).toHaveLength(2)
  })
})

describe('removeSent', () => {
  it('keeps a fold made while its op was being sent', () => {
    const sending = [{ key: 'a', op: 'add', id: '1', item: item('1') }]
    // While the add is on its way, the user edits the item: the add is folded under a new key.
    const outbox = queueOp(sending, { key: 'b', op: 'update', id: '1', patch: { note: 'x' } })
    expect(removeSent(outbox, sending)).toEqual(outbox)
  })

  it('removes exactly the ops that were sent', () => {
    const outbox = [
      { key: 'a', op: 'delete', id: '1' },
      { key: 'b', op: 'delete', id: '2' },
      { key: 'c', op: 'delete', id: '3' },
    ]
    expect(removeSent(outbox, outbox.slice(0, 2))).toEqual([outbox[2]])
  })
})

describe('takeBatch', () => {
  it('sends all changes together before any photo', () => {
    const ops = [
      { op: 'add', id: '1', item: item('1') },
      { op: 'photo', id: '1' },
      { op: 'update', id: '2', patch: {} },
      { op: 'photo', id: '2' },
      { op: 'delete', id: '3' },
    ]
    expect(takeBatch(ops)).toEqual({ kind: 'changes', ops: [ops[0], ops[2], ops[4]] })
    expect(takeBatch([ops[1], ops[3]])).toEqual({ kind: 'photo', ops: [ops[1]] })
    expect(takeBatch([])).toBeNull()
  })

  it('caps a batch', () => {
    const ops = Array.from({ length: 250 }, (_, i) => ({ op: 'delete', id: String(i) }))
    expect(takeBatch(ops, 100).ops).toHaveLength(100)
  })
})

describe('itemForSheet', () => {
  it('keeps only the sheet’s fields and uses the legacy type as the name', () => {
    expect(itemForSheet({ id: '1', type: 'Monitor', serial: 'A', hasPhoto: true, extra: 1, scannedAt: 'x' })).toEqual({
      id: '1',
      serial: 'A',
      category: '',
      name: 'Monitor',
      user: '',
      model: '',
      color: '',
      location: '',
      note: '',
      source: 'manual',
      scannedAt: 'x',
    })
  })
})

describe('sortNewestFirst', () => {
  it('orders by scan time', () => {
    expect(sortNewestFirst([item('1'), item('3'), item('2')]).map((s) => s.id)).toEqual(['3', '2', '1'])
  })
})
