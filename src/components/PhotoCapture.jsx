import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Check, History, ImageUp, LoaderCircle, RefreshCw } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from './ui.jsx'
import { PageHeader } from './Layout.jsx'
import ScanForm from './ScanForm.jsx'
import { makeId, savePrefs } from '../storage.js'
import { savePhoto } from '../photos.js'
import { photoFromFile, photoFromVideo } from '../lib/image.js'
import { useToast } from '../lib/toast.js'
import { cn } from '../lib/utils.js'
import { isRemote } from '../lib/api.js'

const canUseCamera = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

const STATUS_TEXT = {
  starting: 'Starting camera…',
  live: 'Fill the frame with the S/N sticker, then take the photo',
  unsupported: 'The camera isn’t available here. It needs HTTPS or localhost. Choose a photo instead.',
  denied: 'Camera access was blocked. Allow camera access in your browser settings, or choose a photo instead.',
  error: 'The camera couldn’t start. Check that no other app is using it, or choose a photo instead.',
}

const BLOCKED = ['unsupported', 'denied', 'error']

const CORNERS = [
  'top-0 left-0 rounded-tl-lg border-t-4 border-l-4',
  'top-0 right-0 rounded-tr-lg border-t-4 border-r-4',
  'bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4',
  'bottom-0 right-0 rounded-br-lg border-b-4 border-r-4',
]

/**
 * Photo-only capture: take (or choose) a photo of the S/N sticker, then fill in the item form.
 * No text reading runs here, so the OCR engine is never loaded.
 */
export default function PhotoCapture({ scans, onSave, onHistory }) {
  const videoRef = useRef(null)
  const fileRef = useRef(null)
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState(() => (canUseCamera() ? 'starting' : 'unsupported'))
  const [taking, setTaking] = useState(false)
  const [flash, setFlash] = useState(0)
  const [pending, setPending] = useState(null)
  const [savedCount, setSavedCount] = useState(0)
  const toast = useToast()

  useEffect(() => {
    if (!canUseCamera()) return
    let stream
    let cancelled = false

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
        if (!cancelled) setStatus('live')
      } catch (err) {
        if (!cancelled) setStatus(err?.name === 'NotAllowedError' ? 'denied' : 'error')
      }
    })()

    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [attempt])

  // The form shows the photo through an object URL; free it once the form closes or the page unmounts.
  const photoUrl = pending?.photoUrl
  useEffect(() => () => photoUrl && URL.revokeObjectURL(photoUrl), [photoUrl])

  function openForm(blob) {
    setPending({
      id: makeId(),
      serial: '',
      model: '',
      color: '',
      source: 'photo',
      photo: blob,
      photoUrl: URL.createObjectURL(blob),
    })
  }

  async function takePhoto() {
    if (status !== 'live' || taking) return
    setTaking(true)
    setFlash((n) => n + 1)
    navigator.vibrate?.(40)
    try {
      openForm(await photoFromVideo(videoRef.current))
    } catch {
      toast('The photo couldn’t be taken. Try again, or choose a photo instead.', { type: 'error' })
    } finally {
      setTaking(false)
    }
  }

  async function pickFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // so choosing the same file again still fires onChange
    if (!file) return
    setTaking(true)
    try {
      openForm(await photoFromFile(file))
    } catch {
      toast('That file couldn’t be opened as a photo. Choose a JPEG or PNG image.', { type: 'error' })
    } finally {
      setTaking(false)
    }
  }

  function retry() {
    setStatus('starting')
    setAttempt((n) => n + 1)
  }

  async function handleSave(details) {
    const id = makeId()
    let stored = true
    try {
      await savePhoto(id, pending.photo)
    } catch {
      stored = false // keep the item anyway; losing the typed details would be worse
    }
    onSave({
      id,
      source: 'photo',
      scannedAt: new Date().toISOString(),
      ...details,
      ...(stored && { hasPhoto: true }),
    })
    savePrefs({ name: details.name, location: details.location })
    setSavedCount((n) => n + 1)

    const label = [details.serial, details.name].filter(Boolean).join(' · ')
    if (!stored) {
      toast(`Saved ${label || 'the item'}, but the photo couldn’t be stored on this device.`, { type: 'error' })
    } else if (!details.serial) {
      toast(`Saved ${label || 'the photo'}. Add the serial number later in the spreadsheet.`)
    } else {
      toast(`Saved ${label}.`)
    }
    setPending(null)
  }

  const cameraBlocked = BLOCKED.includes(status)
  const StatusIcon = status === 'starting' ? LoaderCircle : cameraBlocked ? CameraOff : Camera

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Photo"
        description="Take a photo of the S/N sticker, then type the details. Nothing is read from the photo."
        actions={
          <Button variant="outline" onClick={onHistory}>
            <History aria-hidden="true" />
            History
            {savedCount > 0 && (
              <Badge variant="secondary" className="tabular-nums">
                +{savedCount}
                <span className="sr-only"> saved this visit</span>
              </Badge>
            )}
          </Button>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,34rem)_minmax(0,1fr)]">
        <div className="grid gap-3">
          {/* The camera surface stays black in both themes, so its colors are fixed too. */}
          <div
            className={cn(
              'relative max-h-[56dvh] w-full overflow-hidden rounded-xl border bg-black text-white shadow-xs',
              cameraBlocked ? 'aspect-[16/10]' : 'aspect-[4/5]',
            )}
          >
            {!cameraBlocked && <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />}

            {!cameraBlocked && (
              // A guide only; the photo is the whole viewfinder. It ends above the status pill.
              <div className="absolute inset-x-[7%] top-[7%] bottom-[19%]" aria-hidden="true">
                {CORNERS.map((corner) => (
                  <span
                    key={corner}
                    className={cn('absolute size-8 transition-colors duration-150', corner, status === 'live' ? 'border-white' : 'border-white/40')}
                  />
                ))}
              </div>
            )}

            {flash > 0 && (
              <div
                key={flash}
                className="pointer-events-none absolute inset-0 bg-white opacity-0 animate-[shutter_220ms_ease-out]"
                aria-hidden="true"
              />
            )}

            <p
              role="status"
              className={cn(
                'absolute inset-x-4 mx-auto flex max-w-[60ch] items-center justify-center gap-2 text-center',
                cameraBlocked
                  ? 'top-1/2 -translate-y-1/2 flex-col gap-3 text-base leading-snug text-white/90'
                  : 'bottom-4 rounded-lg bg-black/70 px-3.5 py-2.5 text-sm backdrop-blur-sm',
              )}
            >
              <StatusIcon
                className={cn('shrink-0', cameraBlocked ? 'size-6 text-white/70' : 'size-4', status === 'starting' && 'animate-spin')}
                aria-hidden="true"
              />
              <span>{STATUS_TEXT[status]}</span>
            </p>
          </div>

          {status === 'error' ? (
            <Button size="lg" className="w-full" onClick={retry}>
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          ) : (
            !cameraBlocked && (
              <Button size="lg" className="w-full" onClick={takePhoto} disabled={status !== 'live'} loading={taking}>
                {!taking && <Camera aria-hidden="true" />}
                Take photo
              </Button>
            )
          )}

          <Button
            size="lg"
            variant={status === 'unsupported' || status === 'denied' ? 'default' : 'outline'}
            className="w-full"
            onClick={() => fileRef.current?.click()}
            disabled={taking}
          >
            <ImageUp aria-hidden="true" />
            Choose a photo
          </Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" tabIndex={-1} aria-hidden="true" onChange={pickFile} />
        </div>

        <Card as="section" aria-labelledby="photo-tips-heading">
          <CardHeader>
            <CardTitle id="photo-tips-heading">For a readable photo</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            <ul className="grid gap-2 text-sm text-muted-foreground">
              {[
                'Get close, so the S/N sticker fills most of the frame.',
                'Hold steady and let the camera focus before you tap.',
                'Tilt the device a little to get rid of glare.',
                isRemote
                  ? 'The photo is saved with the item and uploaded to the team’s Google Drive folder. Open the item later to check it.'
                  : 'The photo is saved with the item on this device. Open the item later to check it.',
              ].map((tip) => (
                <li key={tip} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {pending && (
        <ScanForm key={pending.id} pending={pending} scans={scans} onSave={handleSave} onDiscard={() => setPending(null)} />
      )}
    </div>
  )
}
