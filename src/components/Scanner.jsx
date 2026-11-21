import { useCallback, useEffect, useRef, useState } from 'react'
import { BackIcon } from './Icons.jsx'
import { loadPrefs, makeId, savePrefs, formatDay, formatTime } from '../storage.js'
import { createRepeatGate, extractField, extractSerial, getWorker, recognize } from '../ocr.js'
import { eraseBoxes } from '../preprocess.js'

const canUseCamera = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

// The on-screen frame covers this share of the viewfinder (keep in sync with .frame in App.css).
const FRAME_W = 0.84
const FRAME_H = 0.36
const SCAN_INTERVAL_MS = 900

const STATUS_TEXT = {
  starting: 'Starting camera…',
  loading: 'Loading text reader…',
  live: 'Point the frame at the S/N on the label',
  reading: 'Reading text…',
  paused: 'Serial number found',
  unsupported: "The camera isn't available here. It needs HTTPS or localhost. Type the serial number below.",
  denied: 'Camera access was blocked. Allow camera access in your browser settings, or type the serial number below.',
  error: "The camera couldn't start. Check that no other app is using it, or type the serial number below.",
  'ocr-error': "The text reader couldn't load. Check your connection, or type the serial number below.",
}

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

export default function Scanner({ scans, onSave, onBack, onHistory }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const pausedRef = useRef(false)
  // Keeps a label that is still in view from re-opening the sheet after Save/Discard.
  const [gate] = useState(() => createRepeatGate(2))
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState(() => (canUseCamera() ? 'starting' : 'unsupported'))
  const [pending, setPending] = useState(null)
  const [manual, setManual] = useState('')
  const [savedCount, setSavedCount] = useState(0)
  const [toast, setToast] = useState('')

  /** OCRs the current frame. Returns true when a serial was found and the sheet opened. */
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
    setPending({
      id: makeId(),
      serial,
      model: extractField(text, ['model', 'model no', 'mdl']) ?? '',
      color: extractField(text, ['color', 'colour']) ?? '',
      source: 'camera',
    })
    return true
  }, [gate])

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

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(id)
  }, [toast])

  async function capture() {
    setStatus('reading')
    const found = await readOnce({ ignoreRepeat: true }).catch(() => false)
    if (!found) {
      setStatus((s) => (s === 'reading' ? 'live' : s))
      setToast('No S/N found. Move closer or type it below.')
    }
  }

  function retry() {
    setStatus('starting')
    setAttempt((n) => n + 1)
  }

  /** Closes the sheet and resumes scanning. `serial` is the raw read, held until it leaves view. */
  function resume(serial) {
    gate.hold(serial)
    pausedRef.current = false
    setPending(null)
    setStatus((s) => (s === 'paused' ? 'live' : s))
  }

  function submitManual(e) {
    e.preventDefault()
    const value = manual.trim()
    if (!value) return
    pausedRef.current = true
    setStatus((s) => (s === 'live' ? 'paused' : s))
    setPending({ id: makeId(), serial: value, model: '', color: '', source: 'manual' })
    setManual('')
  }

  function handleSave(details) {
    onSave({
      id: makeId(),
      source: pending.source,
      scannedAt: new Date().toISOString(),
      ...details,
    })
    savePrefs({ name: details.name, location: details.location })
    setSavedCount((n) => n + 1)
    setToast(`Saved ${details.serial}`)
    resume(pending.serial)
  }

  const cameraBlocked = ['unsupported', 'denied', 'error'].includes(status)

  return (
    <main className="screen scanner">
      <header className="topbar">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back to home">
          <BackIcon />
        </button>
        <h1 className="topbar-title">Scanner</h1>
        <button type="button" className="text-btn" onClick={onHistory}>
          History{savedCount > 0 && <span className="pill">+{savedCount}</span>}
        </button>
      </header>

      <div className={`viewfinder${cameraBlocked ? ' is-blocked' : ''}${status === 'live' ? ' is-live' : ''}`}>
        {!cameraBlocked && <video ref={videoRef} playsInline muted />}
        <div className="frame" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          {status === 'live' && <i className="scanline" />}
        </div>
        <p className="viewfinder-status" role="status">
          {STATUS_TEXT[status]}
        </p>
      </div>

      {(status === 'ocr-error' || status === 'error') && (
        <button type="button" className="btn btn-tape capture-btn" onClick={retry}>
          Try again
        </button>
      )}

      {!cameraBlocked && status !== 'ocr-error' && (
        <button type="button" className="btn btn-dark capture-btn" onClick={capture} disabled={status !== 'live'}>
          {status === 'reading' ? 'Reading…' : 'Capture'}
        </button>
      )}

      <form className="manual" onSubmit={submitManual}>
        <label htmlFor="manual-serial" className="field-label">
          Type a serial number
        </label>
        <div className="manual-row">
          <input
            id="manual-serial"
            className="input mono"
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            placeholder="e.g. 5CG1234XYZ"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck="false"
          />
          <button type="submit" className="btn btn-dark" disabled={!manual.trim()}>
            Add
          </button>
        </div>
      </form>

      {pending && (
        <ConfirmSheet
          key={pending.id}
          pending={pending}
          scans={scans}
          onSave={handleSave}
          onDiscard={() => resume(pending.serial)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  )
}

function ConfirmSheet({ pending, scans, onSave, onDiscard }) {
  const [prefs] = useState(loadPrefs)
  const [serial, setSerial] = useState(pending.serial)
  const [name, setName] = useState(prefs.name ?? '')
  const [model, setModel] = useState(pending.model)
  const [color, setColor] = useState(pending.color)
  const [location, setLocation] = useState(prefs.location ?? '')
  const [note, setNote] = useState('')

  const cleanSerial = serial.trim()
  const existing = cleanSerial && scans.find((s) => s.serial.toLowerCase() === cleanSerial.toLowerCase())

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onDiscard()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDiscard])

  function submit(e) {
    e.preventDefault()
    if (!cleanSerial) return
    onSave({
      serial: cleanSerial,
      name: name.trim(),
      model: model.trim(),
      color: color.trim(),
      location: location.trim(),
      note: note.trim(),
    })
  }

  return (
    <div className="sheet-backdrop">
      <form className="sheet" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <div className="tag">
          <label id="sheet-title" htmlFor="sheet-serial" className="tag-label">
            {pending.source === 'camera' ? 'Serial number read from label' : 'Typed serial number'}
          </label>
          <input
            id="sheet-serial"
            className="tag-serial"
            value={serial}
            onChange={(e) => setSerial(e.target.value.toUpperCase())}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck="false"
          />
          {pending.source === 'camera' && <span className="tag-hint">Check it matches the label. Tap to fix.</span>}
        </div>

        {existing && (
          <p className="notice">
            Already scanned {formatDay(existing.scannedAt).toLowerCase()} at {formatTime(existing.scannedAt)}
            {existing.location ? `, ${existing.location}` : ''}. Saving adds it again.
          </p>
        )}

        <div className="field">
          <label htmlFor="item-name" className="field-label">
            Name
          </label>
          <input
            id="item-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dell Latitude laptop"
            autoFocus
          />
        </div>

        <div className="field-pair">
          <div className="field">
            <label htmlFor="item-model" className="field-label">
              Model
            </label>
            <input
              id="item-model"
              className="input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. 5420"
            />
          </div>
          <div className="field">
            <label htmlFor="item-color" className="field-label">
              Color
            </label>
            <input
              id="item-color"
              className="input"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="e.g. Black"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="loc" className="field-label">
            Location <span className="optional">optional</span>
          </label>
          <input
            id="loc"
            className="input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Stockroom B, shelf 3"
          />
        </div>

        <div className="field">
          <label htmlFor="note" className="field-label">
            Note <span className="optional">optional</span>
          </label>
          <input
            id="note"
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Charger missing"
          />
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn btn-ghost" onClick={onDiscard}>
            Discard
          </button>
          <button type="submit" className="btn btn-tape" disabled={!cleanSerial}>
            Save scan
          </button>
        </div>
      </form>
    </div>
  )
}
