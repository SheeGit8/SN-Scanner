import { useEffect, useState } from 'react'
import { Camera, Check, ImageIcon, ImageOff, Keyboard, Sheet, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog, Dialog, Field, Input, Skeleton } from './ui.jsx'
import PhotoView from './PhotoView.jsx'
import { CategorySelect } from './Category.jsx'
import { formatDate, formatTime, itemName, tidyCategory } from '../storage.js'
import { getPhoto, savePhoto } from '../photos.js'
import { useToast } from '../lib/toast.js'
import { call, deletedFrom, isRemote } from '../lib/api.js'

const FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'e.g. Dell Latitude laptop', wide: true },
  { key: 'category', label: 'Category', select: true, wide: true },
  { key: 'user', label: 'User', placeholder: 'e.g. Juan Dela Cruz', hint: 'The person who uses this item. Blank means it’s in stock.', wide: true },
  { key: 'serial', label: 'Serial number', placeholder: 'e.g. 5CG1234XYZ', mono: true, wide: true },
  { key: 'model', label: 'Model', placeholder: 'e.g. Latitude 5420' },
  { key: 'color', label: 'Color', placeholder: 'e.g. Black' },
  { key: 'location', label: 'Location', placeholder: 'e.g. Stockroom B, shelf 3', wide: true },
  { key: 'note', label: 'Note', placeholder: 'e.g. Charger missing', wide: true },
]

const SOURCES = {
  camera: { icon: Camera, label: 'Read by camera' },
  photo: { icon: ImageIcon, label: 'From a label photo' },
  manual: { icon: Keyboard, label: 'Typed in' },
}

/**
 * The item's label photo as an object URL: the copy on this device, else the one in the sheet's
 * Drive folder (downloaded once, then kept on this device). `missing` when there is neither.
 */
function useItemPhoto(scan) {
  const id = scan.hasPhoto ? scan.id : null
  const photoId = scan.photoId || ''
  const [photo, setPhoto] = useState({ url: null, missing: false, error: '' })
  useEffect(() => {
    if (!id) return
    let url
    let cancelled = false
    ;(async () => {
      let blob = await getPhoto(id).catch(() => undefined)
      if (!blob && photoId && isRemote) {
        const dataUrl = await call('getPhoto', photoId)
        blob = await (await fetch(dataUrl)).blob()
        savePhoto(id, blob, { persist: false }).catch(() => {})
      }
      if (cancelled) return
      if (!blob) return setPhoto({ url: null, missing: true, error: '' })
      url = URL.createObjectURL(blob)
      setPhoto({ url, missing: false, error: '' })
    })().catch((err) => !cancelled && setPhoto({ url: null, missing: true, error: err.message || 'Couldn’t load the photo.' }))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id, photoId])
  return photo
}

const initialValues = (scan) =>
  Object.fromEntries(
    FIELDS.map(({ key }) => [key, key === 'name' ? itemName(scan) : key === 'category' ? tidyCategory(scan.category) : (scan[key] ?? '')]),
  )

export default function ItemDrawer({ scan, onClose, onUpdate, onDelete, onShowInSheet }) {
  const [values, setValues] = useState(() => initialValues(scan))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [leaving, setLeaving] = useState(null) // the action waiting on "Discard unsaved changes?"
  const toast = useToast()
  const photo = useItemPhoto(scan)

  const original = initialValues(scan)
  const dirty = FIELDS.some(({ key }) => values[key].trim() !== String(original[key]).trim())
  const label = scan.serial || itemName(scan) || 'the item'

  /** Runs `action` now, or after the user agrees to drop their unsaved edits. */
  const guard = (action) => (dirty ? setLeaving(() => action) : action())

  function save(e) {
    e.preventDefault()
    if (!dirty) return
    const patch = Object.fromEntries(FIELDS.map(({ key }) => [key, values[key].trim()]))
    onUpdate(scan.id, patch)
    toast(`Saved changes to ${patch.serial || patch.name || 'the item'}.`)
  }

  const { icon: SourceIcon, label: sourceLabel } = SOURCES[scan.source] ?? SOURCES.manual

  return (
    <>
      <Dialog
        open
        side="right"
        onClose={() => guard(onClose)}
        onSubmit={save}
        eyebrow="Item details"
        title={itemName(scan) || 'Unnamed item'}
        footer={
          <>
            <Button variant="outline" className="sm:mr-auto" onClick={() => guard(() => onShowInSheet(scan.id))}>
              <Sheet aria-hidden="true" />
              Show in spreadsheet
            </Button>
            <Button type="submit" disabled={!dirty}>
              <Check aria-hidden="true" />
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <div className="rounded-lg border border-l-4 border-l-foreground bg-muted/40 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">Serial number</p>
            <p className="font-mono text-xl font-semibold break-all">{scan.serial || '—'}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <SourceIcon className="size-3.5 shrink-0" aria-hidden="true" />
              {sourceLabel} · {formatDate(scan.scannedAt)} · {formatTime(scan.scannedAt)}
            </p>
          </div>

          {scan.hasPhoto &&
            (photo.url ? (
              <PhotoView src={photo.url} className="h-56" />
            ) : photo.missing ? (
              <p className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                <ImageOff className="size-4 shrink-0" aria-hidden="true" />
                {photo.error
                  ? `Couldn’t load the photo. ${photo.error}`
                  : isRemote
                    ? 'The photo hasn’t reached the Google Drive folder yet.'
                    : 'Photo not available on this device.'}
              </p>
            ) : (
              <Skeleton className="h-56 w-full rounded-lg" />
            ))}

          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ key, label: fieldLabel, placeholder, hint, mono, wide, select }) => (
              <Field key={key} id={`item-${key}`} label={fieldLabel} hint={hint} className={wide ? 'sm:col-span-2' : undefined}>
                {(p) =>
                  select ? (
                    <CategorySelect {...p} value={values[key]} onChange={(v) => setValues((cur) => ({ ...cur, [key]: v }))} />
                  ) : (
                    <Input
                      {...p}
                      value={values[key]}
                      placeholder={placeholder}
                      className={mono ? 'font-mono' : undefined}
                      autoComplete="off"
                      spellCheck={key === 'note'}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                    />
                  )
                }
              </Field>
            ))}
          </div>

          <div className="border-t pt-5">
            <Button variant="ghost" size="sm" className="-ml-3 text-destructive hover:bg-danger-bg hover:text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" />
              Delete item
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this item?"
        description={`Removes ${label} ${deletedFrom}. This can’t be undone.`}
        cancelLabel="Keep item"
        confirmLabel="Delete item"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          onDelete(scan.id)
          toast(`Deleted ${label}.`)
        }}
      />

      <ConfirmDialog
        open={!!leaving}
        title="Discard unsaved changes?"
        description="Your edits to this item won’t be saved."
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        onCancel={() => setLeaving(null)}
        onConfirm={() => {
          const action = leaving
          setLeaving(null)
          action()
        }}
      />
    </>
  )
}
