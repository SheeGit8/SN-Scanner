import { useState } from 'react'
import { Check } from 'lucide-react'
import { Alert, Button, ConfirmDialog, Dialog, Field, Input } from './ui.jsx'
import PhotoView from './PhotoView.jsx'
import { formatDay, formatTime, loadPrefs } from '../storage.js'

/** "today at 7:06 AM", "yesterday at …" or "on Wed, Nov 18, 2026 at …" */
function scannedPhrase(iso) {
  const day = formatDay(iso)
  const when = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : `on ${day}`
  return `${when} at ${formatTime(iso)}`
}

const COPY = {
  camera: {
    title: 'Check the serial number',
    description: 'Read from the label. Fix any character that doesn’t match.',
    serialLabel: 'Serial number read from the label',
    serialHint: 'Check it matches the label. Tap to fix.',
    save: 'Save scan',
    discardTitle: 'Discard this scan?',
    discardText: 'The serial number and the details you typed won’t be saved.',
    discardLabel: 'Discard scan',
  },
  manual: {
    title: 'Add item',
    description: 'Add the details now, or later in the spreadsheet.',
    serialLabel: 'Serial number',
    serialHint: 'Saved in capital letters.',
    save: 'Save scan',
    discardTitle: 'Discard this scan?',
    discardText: 'The serial number and the details you typed won’t be saved.',
    discardLabel: 'Discard scan',
  },
  photo: {
    title: 'Add item from photo',
    description: 'Type the serial number from the photo, then add the details.',
    serialLabel: 'Serial number',
    serialHint: 'Copy it from the photo, or leave it blank and add it later. Saved in capital letters.',
    save: 'Save item',
    discardTitle: 'Discard this photo?',
    discardText: 'The photo and the details you typed won’t be saved.',
    discardLabel: 'Discard photo',
  },
}

/**
 * The item form shown after a scan, a typed serial or a photo. `pending` is
 * { serial, model, color, source: 'camera' | 'manual' | 'photo', photoUrl? }.
 * The serial is required, except with a photo, which already holds it.
 * `onSave(details)` may return a promise; the form stays busy until it settles.
 */
export default function ScanForm({ pending, scans, onSave, onDiscard }) {
  const [prefs] = useState(loadPrefs)
  const [serial, setSerial] = useState(pending.serial)
  const [name, setName] = useState(prefs.name ?? '')
  const [user, setUser] = useState('')
  const [model, setModel] = useState(pending.model)
  const [color, setColor] = useState(pending.color)
  const [location, setLocation] = useState(prefs.location ?? '')
  const [note, setNote] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [saving, setSaving] = useState(false)

  const copy = COPY[pending.source] ?? COPY.manual
  const isPhoto = pending.source === 'photo'
  const serialRequired = !isPhoto
  const cleanSerial = serial.trim()
  const existing = cleanSerial && scans.find((s) => s.serial?.toLowerCase() === cleanSerial.toLowerCase())
  const dirty =
    isPhoto ||
    serial !== pending.serial ||
    name !== (prefs.name ?? '') ||
    user !== '' ||
    model !== pending.model ||
    color !== pending.color ||
    location !== (prefs.location ?? '') ||
    note !== ''

  // Esc, the X and a backdrop tap ask first once something was typed (or a photo taken). The Discard button doesn't.
  const requestClose = () => (dirty ? setConfirmDiscard(true) : onDiscard())

  async function submit(e) {
    e.preventDefault()
    if (saving || (serialRequired && !cleanSerial)) return
    setSaving(true)
    try {
      await onSave({
        serial: cleanSerial,
        name: name.trim(),
        user: user.trim(),
        model: model.trim(),
        color: color.trim(),
        location: location.trim(),
        note: note.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  const text = (value, set, props = {}) => (p) => (
    <Input {...p} value={value} onChange={(e) => set(e.target.value)} autoComplete="off" {...props} />
  )

  return (
    <>
      <Dialog
        open
        busy={saving}
        onClose={requestClose}
        onSubmit={submit}
        title={copy.title}
        description={copy.description}
        footer={
          <>
            <Button variant="outline" onClick={onDiscard} disabled={saving}>
              Discard
            </Button>
            <Button type="submit" disabled={serialRequired && !cleanSerial} loading={saving}>
              {!saving && <Check aria-hidden="true" />}
              {copy.save}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          {pending.photoUrl && <PhotoView src={pending.photoUrl} className="h-56 sm:h-64" />}

          <div className="rounded-lg border border-l-4 border-l-foreground bg-muted/40 p-4">
            <Field id="scan-serial" label={copy.serialLabel} required={serialRequired} optional={!serialRequired} hint={copy.serialHint}>
              {(p) => (
                <Input
                  {...p}
                  value={serial}
                  onChange={(e) => setSerial(e.target.value.toUpperCase())}
                  className="h-12 font-mono text-xl font-semibold tracking-wide sm:text-xl pointer-coarse:h-12"
                  placeholder={isPhoto ? 'e.g. 5CG1234XYZ' : undefined}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck="false"
                  data-autofocus={isPhoto || undefined}
                />
              )}
            </Field>
          </div>

          {existing && (
            <Alert variant="warning" title="Already in the stock list">
              Scanned {scannedPhrase(existing.scannedAt)}
              {existing.location ? ` · ${existing.location}` : ''}. Saving adds it again.
            </Alert>
          )}

          <Field id="scan-name" label="Name" hint="Remembered on this device for the next scan.">
            {text(name, setName, { placeholder: 'e.g. Dell Latitude laptop', 'data-autofocus': !isPhoto || undefined })}
          </Field>

          <Field id="scan-user" label="User" optional hint="The person who uses this item. Leave it blank if it’s in stock.">
            {text(user, setUser, { placeholder: 'e.g. Juan Dela Cruz' })}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field id="scan-model" label="Model">
              {text(model, setModel, { placeholder: 'e.g. 5420' })}
            </Field>
            <Field id="scan-color" label="Color">
              {text(color, setColor, { placeholder: 'e.g. Black' })}
            </Field>
          </div>

          <Field id="scan-location" label="Location" optional hint="Remembered on this device for the next scan.">
            {text(location, setLocation, { placeholder: 'e.g. Stockroom B, shelf 3' })}
          </Field>

          <Field id="scan-note" label="Note" optional>
            {text(note, setNote, { placeholder: 'e.g. Charger missing', autoComplete: 'off', spellCheck: true })}
          </Field>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        title={copy.discardTitle}
        description={copy.discardText}
        cancelLabel="Keep editing"
        confirmLabel={copy.discardLabel}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={onDiscard}
      />
    </>
  )
}
