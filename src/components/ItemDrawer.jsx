import { useEffect, useState } from 'react'
import { Check, Sheet, Trash2, X } from 'lucide-react'
import { Button } from './ui/button.jsx'
import { Input, Label } from './ui/input.jsx'
import { itemName } from '../storage.js'

const FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'e.g. Dell Latitude laptop' },
  { key: 'serial', label: 'Serial number', placeholder: 'e.g. 5CG1234XYZ', mono: true },
  { key: 'model', label: 'Model', placeholder: 'e.g. Latitude 5420' },
  { key: 'color', label: 'Color', placeholder: 'e.g. Black' },
  { key: 'location', label: 'Location', placeholder: 'e.g. Stockroom B, shelf 3' },
  { key: 'note', label: 'Note', placeholder: 'e.g. Charger missing' },
]

const initialValues = (scan) =>
  Object.fromEntries(FIELDS.map(({ key }) => [key, key === 'name' ? itemName(scan) : (scan[key] ?? '')]))

export default function ItemDrawer({ scan, onClose, onUpdate, onDelete, onShowInSheet }) {
  const [values, setValues] = useState(() => initialValues(scan))
  const [saved, setSaved] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const original = initialValues(scan)
  const dirty = FIELDS.some(({ key }) => values[key].trim() !== String(original[key]).trim())

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function save(e) {
    e.preventDefault()
    const patch = Object.fromEntries(FIELDS.map(({ key }) => [key, values[key].trim()]))
    onUpdate(scan.id, patch)
    setSaved(true)
  }

  const scannedAt = new Date(scan.scannedAt)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-foreground/40" aria-hidden="true" onClick={onClose} />
      <form
        onSubmit={save}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="relative flex h-full w-full max-w-md flex-col bg-card shadow-xl motion-safe:animate-[drawer-in_200ms_ease-out]"
      >
        <header className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Item details</p>
            <h2 id="drawer-title" className="truncate text-lg font-semibold">
              {itemName(scan) || 'Unnamed item'}
            </h2>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close details" onClick={onClose} autoFocus>
            <X />
          </Button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="rounded-lg border border-border border-l-4 border-l-accent bg-background px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Serial number</p>
            <p className="font-mono text-xl font-semibold break-all">{scan.serial || '—'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {scan.source === 'camera' ? 'Read by camera' : 'Typed in'} on{' '}
              {scannedAt.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })} at{' '}
              {scannedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ key, label, placeholder, mono }) => (
              <div key={key} className={key === 'note' || key === 'name' ? 'sm:col-span-2' : undefined}>
                <Label htmlFor={`f-${key}`} className="mb-1.5 block">
                  {label}
                </Label>
                <Input
                  id={`f-${key}`}
                  value={values[key]}
                  placeholder={placeholder}
                  className={mono ? 'font-mono' : undefined}
                  autoComplete="off"
                  spellCheck={key === 'note'}
                  onChange={(e) => {
                    setValues((v) => ({ ...v, [key]: e.target.value }))
                    setSaved(false)
                  }}
                />
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-5">
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-destructive-soft p-3" role="alert">
                <p className="mr-auto text-sm font-medium text-destructive">Delete this item permanently?</p>
                <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                  Keep
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onDelete(scan.id)}>
                  Delete item
                </Button>
              </div>
            ) : (
              <Button variant="destructive-ghost" size="sm" onClick={() => setConfirming(true)}>
                <Trash2 aria-hidden="true" />
                Delete item
              </Button>
            )}
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-border px-5 py-4">
          <Button variant="secondary" onClick={() => onShowInSheet(scan.id)}>
            <Sheet aria-hidden="true" />
            Show in spreadsheet
          </Button>
          <span className="ml-auto text-sm text-accent-strong" role="status">
            {saved && !dirty && (
              <span className="inline-flex items-center gap-1">
                <Check className="size-4" aria-hidden="true" />
                Saved
              </span>
            )}
          </span>
          <Button type="submit" disabled={!dirty}>
            Save changes
          </Button>
        </footer>
      </form>
    </div>
  )
}
