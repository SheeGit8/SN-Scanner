/*
 * The rules for syncing with the Google Sheet (app-script/code.gs). stock.js runs them.
 *
 * Every change is applied on this device at once and queued in an outbox, which is kept in
 * localStorage so nothing is lost when the phone is offline or the tab closes. The outbox is
 * sent to the sheet in order. What the screens show is the sheet's last copy with the queued
 * changes applied on top, so the list is right even before the sheet has them.
 *
 * Ops (each has a unique `key`):
 *   { op: 'add',    id, item }   a new item (an add for an id the sheet already has replaces it)
 *   { op: 'update', id, patch }  changed fields only, so two people editing different fields don't clash
 *   { op: 'delete', id }
 *   { op: 'photo',  id }         upload the label photo stored on this device for item `id`
 * Every op can be sent twice without harm, which makes retries safe. After a send, only the ops
 * with the keys that were sent leave the outbox. Folding a new change into a queued op gives it
 * the new change's key, so a fold into an op that is being sent (by this tab or another one) is
 * sent again rather than lost.
 */
import { itemName } from './storage.js'

/** Fields the sheet stores for an item (see ITEM_FIELDS in code.gs). */
const SHEET_FIELDS = ['serial', 'name', 'user', 'model', 'color', 'location', 'note', 'source', 'scannedAt']

/** The part of a scan record that goes to the sheet. Older records keep their name in `type`. */
export function itemForSheet(scan) {
  const out = { id: scan.id }
  for (const key of SHEET_FIELDS) out[key] = String(scan[key] ?? '')
  out.name = itemName(scan)
  out.source ||= 'manual'
  return out
}

/** The list on screen: `items` with `ops` applied in order. Applying the same ops twice changes nothing more. */
export function applyOps(items, ops) {
  let list = items
  for (const o of ops) {
    if (o.op === 'add') {
      const at = list.findIndex((s) => s.id === o.id)
      list = at === -1 ? [o.item, ...list] : list.map((s, i) => (i === at ? { ...s, ...o.item } : s))
    } else if (o.op === 'update') {
      list = list.map((s) => (s.id === o.id ? { ...s, ...o.patch } : s))
    } else if (o.op === 'delete') {
      list = list.filter((s) => s.id !== o.id)
    } else if (o.op === 'photo') {
      list = list.map((s) => (s.id === o.id ? { ...s, hasPhoto: true } : s))
    }
  }
  return list
}

/** Adds `op` to the outbox, folding an update into the item's last queued add or update. */
export function queueOp(outbox, op) {
  if (op.op === 'update') {
    const i = outbox.findLastIndex((o) => o.id === op.id)
    const last = outbox[i]
    if (last?.op === 'add' || last?.op === 'update') {
      const folded =
        last.op === 'add'
          ? { ...last, key: op.key, item: { ...last.item, ...op.patch } }
          : { ...last, key: op.key, patch: { ...last.patch, ...op.patch } }
      return outbox.map((o, j) => (j === i ? folded : o))
    }
    return [...outbox, op]
  }

  if (op.op === 'delete') {
    // Queued changes to the item no longer matter. The delete itself is always sent, because a
    // queued add may already be on its way to the sheet.
    return [...outbox.filter((o) => o.id !== op.id), op]
  }

  return [...outbox, op]
}

/** The outbox without the ops that were sent (matched by key, so folds made meanwhile stay). */
export function removeSent(outbox, sent) {
  const keys = new Set(sent.map((o) => o.key))
  return outbox.filter((o) => !keys.has(o.key))
}

/**
 * The next request to send: all queued changes together, in order (up to `max`), then the photo
 * uploads one at a time. Changes may go ahead of a photo: a photo only fills in its item's Photo
 * cell, and its own item's add is never behind it (adds are queued before their photo).
 */
export function takeBatch(outbox, max = 100) {
  const changes = outbox.filter((o) => o.op !== 'photo')
  if (changes.length) return { kind: 'changes', ops: changes.slice(0, max) }
  return outbox.length ? { kind: 'photo', ops: [outbox[0]] } : null
}

/** Newest scan first, the order every list in the app uses. */
export const sortNewestFirst = (items) =>
  [...items].sort((a, b) => String(b.scannedAt ?? '').localeCompare(String(a.scannedAt ?? '')))
