import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  CameraOff,
  Check,
  CircleCheck,
  History,
  LoaderCircle,
  Plus,
  RefreshCw,
  ScanText,
  TriangleAlert,
} from 'lucide-react'
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Field, Input } from './ui.jsx'
import { PageHeader } from './Layout.jsx'
import ScanForm from './ScanForm.jsx'
import { makeId, savePrefs } from '../storage.js'
import { drafts } from '../drafts.js'
import { createRepeatGate, extractField, extractSerial, getWorker, recognize } from '../ocr.js'
import { eraseBoxes } from '../preprocess.js'
import { useToast } from '../lib/toast.js'
import { cn } from '../lib/utils.js'

const canUseCamera = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

// The on-screen frame covers this share of the viewfinder: keep in sync with the frame's
// inset-x-[8%] inset-y-[32%] below, because it is also the OCR crop.
const FRAME_W = 0.84
const FRAME_H = 0.36
const SCAN_INTERVAL_MS = 900

const STATUS_TEXT = {
  starting: 'Starting camera…',
  loading: 'Loading text reader…',
  live: 'Point the frame at the S/N on the label',
  reading: 'Reading text…',
  paused: 'Serial number found',
  unsupported: 'The camera isn’t available here. It needs HTTPS or localhost. Type the serial number instead.',
  denied: 'Camera access was blocked. Allow camera access in your browser settings, or type the serial number instead.',
  error: 'The camera couldn’t start. Check that no other app is using it, or type the serial number instead.',
  'ocr-error': 'The text reader couldn’t load. Check your connection, or type the serial number instead.',
}

const BLOCKED = ['unsupported', 'denied', 'error']

/**
 * Copies the part of the video under the on-screen frame into `canvas`, upscaled and
 * converted to high-contrast grayscale, which Tesseract reads far more reliably. Boxes
 * printed around text are erased, because Tesseract drops text enclosed by one.
 */
function grabFrame(video, canvas) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  const cw = video.clientWidth
  const ch = video.clientHeight
  if (!vw || !vh || !cw || !ch) return false

  // The video uses object-fit: cover, so work out which part of the source is visible.
  const scale = Math.max(cw / vw, ch / vh)
  const visW = cw / scale
  const visH = ch / scale
  const sw = visW * FRAME_W
  const sh = visH * FRAME_H
  const sx = (vw - sw) / 2
  const sy = (vh - sh) / 2

  const up = Math.min(2.5, Math.max(1, 1200 / sw))
  canvas.width = Math.round(sw * up)
  canvas.height = Math.round(sh * up)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  let min = 255
  let max = 0
  for (let i = 0; i < px.length; i += 4) {
    const y = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000
    px[i] = y
    if (y < min) min = y
    if (y > max) max = y
  }
  const range = Math.max(1, max - min)
  for (let i = 0; i < px.length; i += 4) {
    const y = ((px[i] - min) * 255) / range
    px[i] = px[i + 1] = px[i + 2] = y
  }
  eraseBoxes(img)
  ctx.putImageData(img, 0, 0)
  return true
}

/** The scan that was being checked when the page was refreshed or closed, to reopen as it was. */
function restoredPending() {
  const draft = drafts.load('scanner')
  return draft && { ...draft.pending, values: draft.values }
}

/** Opens the form for a scan, and keeps it as a draft until it is saved or discarded. */
function openPending(setPending, next) {
  drafts.start('scanner', next)
  setPending(next)
}

export default function Scanner({ scans, onSave, onHistory }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [restored] = useState(restoredPending)
  // Scanning stays paused while the form is open, including one restored from a draft.
  const pausedRef = useRef(!!restored)
  const announcedRef = useRef(false)
  // Keeps a label that is still in view from re-opening the dialog after Save/Discard.
  const [gate] = useState(() => createRepeatGate(2))
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState(() => (canUseCamera() ? 'starting' : 'unsupported'))
  const [pending, setPending] = useState(restored)
  const [manual, setManual] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const toast = useToast()

  /** OCRs the current frame. Returns true when a serial was found and the dialog opened. */
  const readOnce = useCallback(async ({ ignoreRepeat = false } = {}) => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return false
    canvasRef.current ??= document.createElement('canvas')
    if (!grabFrame(video, canvasRef.current)) return false

    const text = await recognize(canvasRef.current)
    if (pausedRef.current) return false
    const serial = extractSerial(text)
    const fresh = gate.accept(serial)
    if (!serial || (!fresh && !ignoreRepeat)) return false

    pausedRef.current = true
    navigator.vibrate?.(60)
    setStatus('paused')
    openPending(setPending, {
      id: makeId(),
      serial,
      model: extractField(text, ['model', 'model no', 'mdl']) ?? '',
      color: extractField(text, ['color', 'colour']) ?? '',
      source: 'camera',
    })
    return true
  }, [gate])

  useEffect(() => {
    if (!restored || announcedRef.current) return
    announcedRef.current = true
    toast('Restored the scan you were checking.', { type: 'info' })
  }, [restored, toast])

  useEffect(() => {
    if (!canUseCamera()) return
    let stream
    let timer
    let cancelled = false

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        video.srcObject = stream
        await video.play()
      } catch (err) {
        if (!cancelled) setStatus(err?.name === 'NotAllowedError' ? 'denied' : 'error')
        return
      }

      setStatus('loading')
      try {
        await getWorker()
      } catch {
        if (!cancelled) setStatus('ocr-error')
        return
      }
      if (cancelled) return
      setStatus('live')

      const loop = async () => {
        if (cancelled) return
        if (!pausedRef.current) {
          try {
            await readOnce()
          } catch {
            // A failed frame is normal; try the next one.
          }
        }
        if (!cancelled) timer = setTimeout(loop, SCAN_INTERVAL_MS)
      }
      loop()
    }

    start()
    return () => {
      cancelled = true
      clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [readOnce, attempt])

  async function capture() {
    setStatus('reading')
    const found = await readOnce({ ignoreRepeat: true }).catch(() => false)
    if (!found) {
      setStatus((s) => (s === 'reading' ? 'live' : s))
      toast('No S/N found. Move closer, or type the serial number instead.', { type: 'info' })
    }
  }

  function retry() {
    setStatus('starting')
    setAttempt((n) => n + 1)
  }

  /** Closes the dialog and resumes scanning. `serial` is the raw read, held until it leaves view. */
  function resume(serial) {
    gate.hold(serial)
    pausedRef.current = false
    drafts.clear('scanner')
    setPending(null)
    setStatus((s) => (s === 'paused' ? 'live' : s))
  }

  function submitManual(e) {
    e.preventDefault()
    const value = manual.trim()
    if (!value) return
    pausedRef.current = true
    setStatus((s) => (s === 'live' ? 'paused' : s))
    openPending(setPending, { id: makeId(), serial: value, model: '', color: '', source: 'manual' })
    setManual('')
  }

  function handleSave(details) {
    onSave({
      id: makeId(),
      source: pending.source,
      scannedAt: new Date().toISOString(),
      ...details,
    })
    savePrefs({ name: details.name, category: details.category, location: details.location })
    setSavedCount((n) => n + 1)
    toast(`Saved ${details.serial}${details.name ? ` · ${details.name}` : ''}.`)
    resume(pending.serial)
  }

  const cameraBlocked = BLOCKED.includes(status)
  // Typing becomes the main action only when there is no Capture or Try again button.
  const typedIsPrimary = status === 'unsupported' || status === 'denied'
  const busy = status === 'starting' || status === 'loading' || status === 'reading'
  const StatusIcon = busy
    ? LoaderCircle
    : status === 'paused'
      ? CircleCheck
      : cameraBlocked
        ? CameraOff
        : status === 'ocr-error'
          ? TriangleAlert
          : ScanText

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Scanner"
        description="Reads the S/N from a device label. Check each read before you save it."
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
          {/* The camera surface stays black in both themes, so its status colors are fixed too. */}
          <div
            className={cn(
              'relative max-h-[56dvh] w-full overflow-hidden rounded-xl border bg-black text-white shadow-xs',
              // No camera: a shorter box, so the typed entry stays in view on phones.
              cameraBlocked ? 'aspect-[16/10]' : 'aspect-[4/5]',
            )}
          >
            {!cameraBlocked && <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />}

            {!cameraBlocked && (
              <div className="absolute inset-x-[8%] inset-y-[32%]" aria-hidden="true">
                {[
                  'top-0 left-0 rounded-tl-lg border-t-4 border-l-4',
                  'top-0 right-0 rounded-tr-lg border-t-4 border-r-4',
                  'bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4',
                  'bottom-0 right-0 rounded-br-lg border-b-4 border-r-4',
                ].map((corner) => (
                  <span
                    key={corner}
                    className={cn(
                      'absolute size-8 transition-colors duration-150',
                      corner,
                      status === 'paused' ? 'border-emerald-400' : status === 'live' ? 'border-white' : 'border-white/40',
                    )}
                  />
                ))}
                {status === 'live' && (
                  <div className="absolute inset-x-1.5 top-[12%] bottom-[12%]">
                    <div className="h-full animate-[sweep_1.8s_ease-in-out_infinite_alternate]">
                      <i className="block h-0.5 rounded-full bg-white/90 shadow-[0_0_12px_rgb(255_255_255/0.8)]" />
                    </div>
                  </div>
                )}
              </div>
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
                className={cn(
                  'shrink-0',
                  cameraBlocked ? 'size-6 text-white/70' : 'size-4',
                  busy && 'animate-spin',
                  status === 'paused' && 'text-emerald-400',
                  status === 'ocr-error' && 'text-amber-300',
                )}
                aria-hidden="true"
              />
              <span>{STATUS_TEXT[status]}</span>
            </p>
          </div>

          {status === 'ocr-error' || status === 'error' ? (
            <Button size="lg" className="w-full" onClick={retry}>
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          ) : (
            !cameraBlocked && (
              <>
                <Button size="lg" className="w-full" onClick={capture} disabled={status !== 'live'} loading={status === 'reading'}>
                  {status !== 'reading' && <Camera aria-hidden="true" />}
                  {status === 'reading' ? 'Reading…' : 'Capture'}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Scanning runs on its own. Use Capture when a label won’t read.
                </p>
              </>
            )
          )}
        </div>

        <div className="grid gap-6">
          <Card as="section" aria-labelledby="manual-heading">
            <CardHeader>
              <CardTitle id="manual-heading">Type a serial number</CardTitle>
              <CardDescription>For labels the camera can’t read.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={submitManual}>
                <Field id="manual-serial" label="Serial number" hint="Saved in capital letters.">
                  {(p) => (
                    <div className="flex gap-2">
                      <Input
                        {...p}
                        className="font-mono"
                        value={manual}
                        onChange={(e) => setManual(e.target.value.toUpperCase())}
                        placeholder="e.g. 5CG1234XYZ"
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck="false"
                      />
                      <Button type="submit" variant={typedIsPrimary ? 'default' : 'outline'} disabled={!manual.trim()}>
                        <Plus aria-hidden="true" />
                        Add
                      </Button>
                    </div>
                  )}
                </Field>
              </form>
            </CardContent>
          </Card>

          <Card as="section" aria-labelledby="tips-heading">
            <CardHeader>
              <CardTitle id="tips-heading">For a clean read</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <ul className="grid gap-2 text-sm text-muted-foreground">
                {[
                  'Fill the frame with the S/N line and hold the phone steady.',
                  'Use even light. Tilt the device a little to get rid of glare.',
                  'Check the read against the label before you save. Fix any wrong characters.',
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
      </div>

      {pending && (
        <ScanForm
          key={pending.id}
          pending={pending}
          scans={scans}
          onSave={handleSave}
          onDiscard={() => resume(pending.serial)}
          onChange={(values) => drafts.update('scanner', pending.id, values)}
        />
      )}
    </div>
  )
}
