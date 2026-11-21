const SCANS_KEY = 'it-stock-scans-v1'
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

export function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function formatDay(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (isSameDay(d, today)) return 'Today'
  if (isSameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Display name for a scan; older records only stored an item type. */
export const itemName = (scan) => scan.name || scan.type || ''

export const CSV_HEADER = ['Serial number', 'Name', 'Model', 'Color', 'Location', 'Note', 'Method', 'Scanned at']

export function csvRow(s) {
  return [
    s.serial ?? '',
    itemName(s),
    s.model ?? '',
    s.color ?? '',
    s.location ?? '',
    s.note ?? '',
    s.source === 'camera' ? 'Camera' : 'Typed',
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
