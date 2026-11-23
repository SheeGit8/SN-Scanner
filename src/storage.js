export const SCANS_KEY = 'it-stock-scans-v1'
const PREFS_KEY = 'it-stock-prefs-v1'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export const loadScans = () => read(SCANS_KEY, [])
export const saveScans = (scans) => localStorage.setItem(SCANS_KEY, JSON.stringify(scans))

export const loadPrefs = () => read(PREFS_KEY, { name: '', location: '' })
export const savePrefs = (prefs) => localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))

export function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** "7:06 AM" */
export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** "Nov 18, 2026" */
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Wed, Nov 18, 2026", for headers. */
export function formatLongDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/** "Today", "Yesterday" or "Wed, Nov 18, 2026". */
export function formatDay(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(d, today)) return 'Today'
  if (isSameDay(d, yesterday)) return 'Yesterday'
  return formatLongDate(iso)
}

/** "Just now", "5 min ago", "2h ago", "Yesterday", "3 days ago", then the date. */
export function formatRelative(iso, now = new Date()) {
  const d = new Date(iso)
  const mins = Math.floor((now - d) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  if (isSameDay(d, now)) return `${Math.floor(mins / 60)}h ago`
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(iso)
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Display name for a scan; older records only stored an item type. */
export const itemName = (scan) => scan.name || scan.type || ''

/** How the item was added: read by the camera, from a label photo, or typed in. */
export const methodLabel = (scan) => ({ camera: 'Camera', photo: 'Photo' })[scan.source] ?? 'Typed'

/** The text fields a search or filter looks in. `user` is the person who uses the item. */
export const searchValues = (s) => [s.serial, itemName(s), s.user, s.model, s.color, s.location, s.note]

const tidyLocation = (location) => String(location ?? '').trim().replace(/\s+/g, ' ')

/** A location made comparable, so "Stockroom B", "stockroom b " and "STOCKROOM  B" are one place. '' is no location. */
export const locationKey = (location) => tidyLocation(location).toLowerCase()

/**
 * The places items are kept, for the location tabs and the dashboard: [{ key, label, count }].
 * Sorted by name, with the items that have no location (key '') last. A place is shown with its
 * most used spelling.
 */
export function locationGroups(scans) {
  const groups = new Map()
  for (const s of scans) {
    const key = locationKey(s.location)
    let group = groups.get(key)
    if (!group) groups.set(key, (group = { key, count: 0, spellings: new Map() }))
    group.count++
    const spelling = tidyLocation(s.location)
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1)
  }
  return [...groups.values()]
    .map(({ key, count, spellings }) => ({
      key,
      count,
      // On a tie, the first spelling seen wins; the list is newest first.
      label: key ? [...spellings].reduce((best, s) => (s[1] > best[1] ? s : best))[0] : 'No location',
    }))
    .sort((a, b) =>
      !a.key !== !b.key ? (a.key ? -1 : 1) : a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }),
    )
}

/** The scans kept at one location (a key from locationGroups), or all of them for null. */
export const inLocation = (scans, key) => (key == null ? scans : scans.filter((s) => locationKey(s.location) === key))

export const CSV_HEADER =['Serial number', 'Name', 'User', 'Model', 'Color', 'Location', 'Note', 'Method', 'Scanned at']

export function csvRow(s) {
  return [
    s.serial ?? '',
    itemName(s),
    s.user ?? '',
    s.model ?? '',
    s.color ?? '',
    s.location ?? '',
    s.note ?? '',
    methodLabel(s),
    new Date(s.scannedAt).toLocaleString(),
  ]
}

export function downloadCsv(scans) {
  const csv = [CSV_HEADER, ...scans.map(csvRow)].map((r) => r.map(csvCell).join(',')).join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `it-stock-scans-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
